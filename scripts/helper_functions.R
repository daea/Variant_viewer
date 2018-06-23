#### Functions to clean up the GET requests ####

# Just for Pulling the response codes and naming the items in the list

parseCommandLineAgis <- function() {
	# Parse AGI ids submitted at the command line to a character vector
	args = commandArgs(trailingOnly = TRUE)
	gids = unlist(str_extract_all(args, 'AT[0-9]G[0-9]+[.]?[0-9]?'))
	if (length(args) == 0) {
		stop("You did not specify any AGI ids.")	
	} else if (length(gids) <= 0) {
		stop("The submitted AGI id's are not of the correct format. Please use \"AT#G#####.#\".")
	} else if (length(gids) >= 11) {
		stop("Please submit 10 or fewer AGI id's")
	} else {
		#print(paste(length(gids), " genes submitted", sep = ""))
		#print(gids)
		return(gids)
	}
}


getStatus <- function(responses, submission_ids) {
	response_codes = lapply(responses, function(response) status_code(response))
	names(response_codes) = unlist(lapply(responses, function(x) x$name))
	for (name in names(response_codes)) {
		if (response_codes[name] != 200) {
			#print(paste("The server could not return results for:", name, "."))
		} else if (response_codes[name] == 200) {
			#print(paste("The server successfully retrieved results for:", name, "."))
		} else {
			#print("An unknown error occurred.","AGI: ", name, ", Response Code: ", response_codes[name]) 
		}
	}
	return(response_codes)
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
			stop("No AGIs were specified at the command line")
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
	return(data)
}


getProteinSeqs <- function(gids) {
	proturl = "http://bar.utoronto.ca/webservices/bar_araport/get_protein_sequence_by_identifier.php?locus="
	prot_responses = lapply(gids, function(x) GET(paste(proturl, x, sep="")))
	
	raw_seqs = unlist(lapply(prot_responses, function(response) content(response)$result[[1]]$sequence))
	names(raw_seqs) = gids
	return(raw_seqs)
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
	return(pfam_domains)
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
	colnames(cdd_data) <- c("agi", "cdd_domain", "residues")
	cdd_residues <- cdd_data %>% separate_rows(residues) %>% extract(residues, into = c("residue", "location"), regex = "([A-Za-z])([0-9]+)")
	cdd_residues$location <- as.numeric(cdd_residues$location)
	return(cdd_residues)
}
