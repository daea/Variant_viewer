#### Functions to clean up the GET requests ####
# Just for Pulling the response codes and naming the items in the list

parseCommandLineAgis <- function() {
	### Input is a string of command line submitted AGIs
	###	Returns a vector of AGI ids

	# Parse AGI ids submitted at the command line to a character vector
	args = commandArgs(trailingOnly = TRUE)
	gids = unique(unlist(str_extract_all(args, 'AT[0-9]G[0-9]+[.]?[0-9]?')))
	
	if (length(gids) == 0) {
		# Did the user submit legitimate AGIs
		addError(list("NoInput" = "You did not specify any valid AGI ids."))		
		return(FALSE)
	} else if (length(gids) <= 0) {
		addError(list("agiFormatError" = "The submitted AGI ids are not of the correct format. Please use \"AT#G#####.#\"."))
		return(FALSE)
	} else if (length(gids) >= 11) {
		# To keep the user for submitting  10+ agis (slow)
		addError(list("largeQuery" = "Please submit 10 or fewer AGI id's"))
		return(FALSE)
	} else {
		rawArgs = unlist(strsplit(args, ','))
		if (length(rawArgs) == length(gids)) {	
		# Check if there are the same number of submitted AGIs as there are extracted ones
			return(gids)
		} else {
		# If there are less gids than submissions, return the failed submissions as an error
		# and proceed with the remaining AGIs
			badAgis = rawArgs[which(! rawArgs %in% gids)]
			addError(list("BadAGI" = sprintf("The following AGIs do not have the correct format: %s", paste(badAgis, sep = ","))))
			return(gids)
		}
	}
}


getVariantStatus <- function(responses, submission_ids) {
	### Input is successful or unsuccessful variant requests
	###	Adds Error statements for each improperly formatted AGI
	response_codes = lapply(responses, function(response) status_code(response))
	names(response_codes) = unlist(lapply(responses, function(x) x$name))
	for (name in names(response_codes)) {
		if (response_codes[name] != 200) {
			addError(list("VariantRequestError" = paste("The server did not return results for:", name, ".")))
		} else if (response_codes[name] == 200) {
			#print(paste("The server successfully retrieved results for:", name, "."))
		} else {
			addError(list(paste("An unknown error occurred.","AGI: ", name, ", Response Code: ", response_codes[name]))) 
		}
	}
	return(response_codes)
}


addError <- function(error) {
	errorList <<- error 
	return(errorList)
}


getVariants <- function (gids) {
	base_url = "http://tools.1001genomes.org/api/v1.1/effects.json?type=snps;accs=all;gid="
	right_url = ";effect=missense_variant"
	variants = list()
	for (i in 1:length(gids)) {
		if (i == length(gids) && i %% 2 == 1) {
			variants[[i]] = GET(paste(base_url, gids[i], right_url, sep=""))
			variants[[i]]$name = gids[i]
			next
			
		} else if ( i %% 2 == 0) {
			variants[[i-1]] = GET(paste(base_url, gids[i-1], right_url, sep=""))
			variants[[i]] = GET(paste(base_url, gids[i], right_url, sep=""))
			variants[[i-1]]$name = gids[i-1]
			variants[[i]]$name = gids[i]
			Sys.sleep(1)
			#print(paste("Request:", i))
		} else if (i == 0) {
			return(FALSE)
		}
	}
	return(variants)
}


formatVariants <- function(variants) {
	records = sum(unlist(lapply(variants, 
		function(variant) length(content(variant)[["data"]]))))
	
	data = data.frame(matrix(nrow = records, ncol = 15)) # Create a dataframe of length = records
	i = 1
	for (agi in variants) {								# Iterate over list of response objects
		for (record in content(agi)[["data"]]) {		# Get the content, iterate over records
			data[i,] = rbind(c(agi$name,unlist(record)))	# Bind into a table and create dataset
			i = i + 1
		}
	}
	names(data) <- c("submission_id",
					 "chr", 
					 "pos",
					 "strain",
					 "type",
					 "effect_impact",
					 "functional_class",
					 "codon_change",
					 "amino_acid_change",
					 "amino_acid_length",
					 "gene_name",
					 "transcript_biotype",
					 "gene_coding",
					 "transcript_id",
					 "exon_rank"
	)
	if (nrow(data) > 0) { # Is there data?
	  return(data)
	} else if (nrow(data) == 0) {
	  return(FALSE)
	}
}


calcFrequencies <- function(data) {
	mutantPattern = "p.([:alpha:]{3})([:digit:]+)([:alpha:]{3})" 	# Matches the snpEFF effect field and extracts variant info
	nsSNPs = summarise(
		group_by(data, gene_name, amino_acid_change, submission_id, pos),
					   n = n()) %>% 
			mutate(freq = n / 1135,         # Split up that variant column
				original = str_match(amino_acid_change, mutantPattern)[2],
				site     = as.numeric(str_match(amino_acid_change, mutantPattern)[3]),
				variant  = str_match(amino_acid_change, mutantPattern)[4]
			)
	nsSNPs$gene_name <- as.factor(nsSNPs$gene_name)
	nsSNPs$submission_id <- as.factor(nsSNPs$submission_id)
	return(nsSNPs)
}


mapVariants <- function(alignedSeqs, nsSNPs) {
	#### Mapping Variants ####
	alignmentMatrix = data.frame(t(as.matrix(aligned_seqs))) # Alignment to matrix
	consensus_length = c(1:nrow(alignmentMatrix))			# Create key value pairs		
	alignmentMatrix = gather(alignmentMatrix)							# Gather them into unique rows
	alignmentMatrix$position = consensus_length 				# Note consensus length is reused here
	alignmentMatrix = alignmentMatrix %>% 							
		mutate(dummy = ifelse(value == "-",yes = 0, no = 1 )) %>%	# Convert gaps to numvers
		group_by(key) %>%							# Group by key (agi)
		mutate(value = value,
			position = position,
			map      = ifelse(dummy == 0, yes = NA, no = cumsum(dummy))
		)											# Actual position to mapped position


	## Map variants onto Alignment for Plotting
	variantMap = left_join(x = alignmentMatrix, y = nsSNPs,
			  by = c("map" = "site", "key" = "submission_id")
			  )
	return(variantMap)

}

siteFrequencies <- function(variantMap) {
	frequency_data <- variantMap %>% 
		mutate(freq  = ifelse(is.na(freq), 0, freq),# Turn NA's into 0's
			   n     = ifelse(is.na(n), 0, n)) %>% 	# Group by position and agi 
		group_by(position, key) %>%
		summarise(cum_freq = sum(freq),             # Calculate cumulative frequencies (diff from REF)
				  intra = sum(freq > 0))	%>%	    
		group_by(position)	%>%				      	# Group by position, Calculate average frequencies
		summarise(av_freq = mean(cum_freq),         
				  interCount = sum(cum_freq > 0),
				  intraCount = sum(intra)           
		)											# Count the number of proteins with a variant
	return(frequency_data)
}



getProteinSeqs <- function(gids) {
	# Removes protein sequences that are shorter than 0 characters
	# Will use this to check if they are all in the variant table
	proturl = "http://bar.utoronto.ca/webservices/bar_araport/get_protein_sequence_by_identifier.php?locus="
	prot_responses = lapply(gids, function(x) GET(paste(proturl, x, sep="")))
	
	raw_seqs = unlist(lapply(prot_responses, function(response) content(response)$result[[1]]$sequence))
	names(raw_seqs) = gids
	return(raw_seqs[which(nchar(raw_seqs) > 0)])
}


filterNullSequences <- function(nsSNPs, raw_seqs) {
	# Remove variant entries that don't have a corresponding protein sequence
	# Otherwise the mapping operation fails outright (can't map to nonexistent sequence)
	removed = unique(nsSNPs$submission_id[which(! nsSNPs$submission_id %in% names(raw_seqs))])
	if (length(removed) > 0) {
		addError(
			list("ProteinError" = 
				 paste("Could not retrieve protein sequence for:", paste(removed, sep="," ))
			 )
		)
		filtered <- nsSNPs %>%
				filter(submission_id %in% names(raw_seqs)) %>%
				droplevels()	
		return(filtered)
	} else {
		return(nsSNPs)
	}
}




getPfamDomains <- function(raw_seqs) {
	pfamurl = "http://bar.utoronto.ca/eplant/cgi-bin/PfamAnnot.cgi"
	prot_fam = lapply(raw_seqs, function(x) fromJSON(xml_text(content(POST(pfamurl, body = list(FASTAseq = x)))), simplifyMatrix = TRUE))
	prot_data = data.frame(matrix(ncol = 4, nrow = 0)) # Initialize an empty data frame
	for (agi in names(prot_fam)) { 
		for (domain in names(prot_fam[[agi]])) {
			for (value in names(prot_fam[[agi]][[domain]])){
				prot_data <- rbind(prot_data, rbind(c(agi, domain, value, prot_fam[[agi]][[domain]][[value]] )))
			}
		}
	}
	colnames(prot_data) <- c("agi", "pfam_domain", "value_type", "value")
	pfam_domains <- prot_data %>% spread(value_type, value)
	
	if (nrow(pfam_domains) > 0) {
		return(pfam_domains)
	} else if (nrow(pfam_domains) == 0) {	
		return(FALSE)
	}
}


getCddDomains <- function(raw_seqs) {
	cddurl  = "http://bar.utoronto.ca/eplant/cgi-bin/CDDannot.cgi"
	cdd_res = lapply(raw_seqs, function(x) fromJSON(xml_text(content(POST(cddurl, body = list(FASTAseq = x)))), simplifyMatrix = TRUE))
	cdd_data = data.frame(matrix(ncol = 3, nrow = 0))
	for (agi in names(cdd_res)) {
		for (domain in names(cdd_res[[agi]])) {
			cdd_data <- rbind(cdd_data, rbind(c(agi, domain, cdd_res[[agi]][[domain]])))
		}
	}
	if (nrow(cdd_data) > 0) {
		colnames(cdd_data) <- c("agi", "cdd_domain", "residues")
		cdd_residues <- cdd_data %>% separate_rows(residues) %>% extract(residues, into = c("residue", "location"), regex = "([A-Za-z])([0-9]+)")
		cdd_residues$location <- as.numeric(cdd_residues$location)
		return(cdd_residues)
	} else if (nrow(cdd_data) == 0) {
		return(FALSE)
	}
}

formatCddPfam <- function(pfam_domains, cdd_residues, variantMap) {
	if (pfam_domains != FALSE && cdd_residues != FALSE) {
	  
	  #### Combine CDD and pfam Data ####
	  pfam_domains$startIndex <- as.numeric(as.character(pfam_domains$startIndex))
	  pfam_domains$endIndex <- as.numeric(as.character(pfam_domains$endIndex))
	  
	  temp_start = left_join(pfam_domains, variantMap, 
		by = c("agi" = "key","startIndex" = "map")) %>%
		mutate(start_pos = position) 
	  temp_start = temp_start %>% select(c(agi, pfam_domain, endIndex, start_pos,PfamAnnot, Expect))
	  
	  pfam_mapped = left_join(temp_start, variantMap, by = c("agi" = "key", "endIndex" = "map")) %>%
		mutate(end_pos = position)
	  pfam_mapped = pfam_mapped %>% select(c(agi, pfam_domain, end_pos, start_pos, PfamAnnot, Expect)) %>%
		mutate(domain = pfam_domain)
	  
	  cdd_mapped <- left_join(cdd_residues, variantMap, by = c("agi"= "key", "location" = "map")) %>%
		select(agi, cdd_domain, residue, position) %>% 
		mutate(domain = cdd_domain) %>%
		mutate(start_pos = position, end_pos = position + 1) %>%
		select(-c(position))
	  
	  cdd_pfam <- full_join(pfam_mapped, cdd_mapped) %>% 
		select(-c(pfam_domain, cdd_domain))
	  
		ids <- nsSNPs %>% group_by(gene_name, submission_id) %>% summarize()
		names(ids) <- c("name", "agi")
		ids$y <- seq(1:length(ids$name))
		
		gene_names <- ids %>% 
			group_by(name) %>%
			mutate( gene_name = ifelse(is.na(name), 
									   yes = as.character(agi), 
									   no = as.character(name)))
	  
	  cdd_pfam <- left_join(cdd_pfam, gene_names, by = c("agi" = "agi"))
	  cdd_pfam$agi <- as.factor(cdd_pfam$agi)
	  levels(cdd_pfam$gene_name) <- as.factor(ids$name)
	  
	} else if ( cdd_residues == FALSE && (nrow(pfam_domains)) > 0) {
	  # If there are no listed CDD domains only format the pfam domains
	  #### Combine CDD and pfam Data ####
	  pfam_domains$startIndex <- as.numeric(as.character(pfam_domains$startIndex))
	  pfam_domains$endIndex <- as.numeric(as.character(pfam_domains$endIndex))
	  
	  temp_start = left_join(pfam_domains, variantMap, 
							 by = c("agi" = "key","startIndex" = "map")) %>%
		mutate(start_pos = position) 
	  temp_start = temp_start %>% select(c(agi, pfam_domain, endIndex, start_pos,PfamAnnot, Expect))
	  
	  pfam_mapped = left_join(temp_start, variantMap, by = c("agi" = "key", "endIndex" = "map")) %>%
		mutate(end_pos = position)
	  pfam_mapped = pfam_mapped %>% select(c(agi, pfam_domain, end_pos, start_pos, PfamAnnot, Expect)) %>%
		mutate(domain = pfam_domain)
	  
	  cdd_pfam <- pfam_mapped %>% 
		select(-c(pfam_domain))
	  
	  ids <- nsSNPs %>% group_by(gene_name, submission_id) %>% summarize()
	  names(ids) <- c("name", "agi")
	  ids$y <- seq(1:length(ids$name))
	  
	  gene_names <- ids %>% 
		group_by(name) %>%
		mutate( gene_name = ifelse(is.na(name), 
								   yes = as.character(agi), 
								   no = as.character(name)))
	  
	  cdd_pfam <- left_join(cdd_pfam, gene_names, by = c("agi" = "agi"))
	  cdd_pfam$agi <- as.factor(cdd_pfam$agi)
	  levels(cdd_pfam$gene_name) <- as.factor(ids$name)
	  
	  
	} else if ( !is.NULL(nrow(cdd_residues)) && pfam_domains == FALSE ) {
	  # If there are no listed PFAM domains, but there are CDD residues
	  
	  #### Combine CDD and pfam Data ####
	  cdd_mapped <- left_join(cdd_residues, variantMap, by = c("agi"= "key", "location" = "map")) %>%
		select(agi, cdd_domain, residue, position) %>% 
		mutate(domain = cdd_domain) %>%
		mutate(start_pos = position, end_pos = position + 1) %>%
		select(-c(position))
	  
	  cdd_pfam <- pfam_mapped %>% 
		select(-c(cdd_domain))

	  ids <- nsSNPs %>% group_by(gene_name, submission_id) %>% summarize()
	  names(ids) <- c("name", "agi")
	  ids$y <- seq(1:length(ids$name))
	  
	  gene_names <- ids %>% 
		group_by(name) %>%
		mutate( gene_name = ifelse(is.na(name), 
								   yes = as.character(agi), 
								   no = as.character(name)))
	  
	  cdd_pfam <- left_join(cdd_pfam, gene_names, by = c("agi" = "agi"))
	  cdd_pfam$agi <- as.factor(cdd_pfam$agi)
	  levels(cdd_pfam$gene_name) <- as.factor(ids$name)
	} else if (pfam_domains == FALSE && cdd_residues == FALSE) {
	  cdd_pfam = list()
	}
	return(cdd_pfam)
}

returnData <- function (cdd_pfam, variantMap, frequency_data, errorlist) {
	return(
		toJSON(list(
					data=list(
						c(cdd_pfam), 
						c(variantMap), 
						c(frequency_data)
						),
					error = errorList
					)
		, pretty = TRUE, na = 'null')
	)
}

returnErrors <- function(errorlist) {
	return(
		   toJSON(list(
					   data=list(
								 error = errorlist)),
					   pretty = TRUE, na = 'null')
		   )
}

#
# failTest <- raw_seqs
# raw_seqsTester <- raw_seqs
# raw_seqsTester_failTest <-raw_seqs
# pfamFailTest <- raw_seqs
# 
# failTest # AT1G01010.1 no CDD domains
# raw_seqsTester # 4 ABFs, always works
# raw_seqsTester_failTest # 3 AFBs and AT1G01010.1
# pfamFailTest
# 
# 
# getCddDomains(failTest)
# getCddDomains(raw_seqsTester)
# getCddDomains(raw_seqsTester_failTest)
# getCddDomains(pfamFailTest)
# 
# getPfamDomains(failTest)
# getPfamDomains(raw_seqsTester)
# getPfamDomains(raw_seqsTester_failTest)
# getPfamDomains(pfamFailTest)
# 
# test_seq = "ASDFGHKLKANSGKANDGKLSDNGSKLDFNGKADNFKASNDKALSDNKASFNAKDGNGKADNGKANSDKFNAK
# SDNASKFNAKGNKANSDFLKASNDL"
# names(test_seq) = "the"
# getPfamDomains(test_seq)w# 
# test_seq
