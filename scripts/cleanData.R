#### 2018 Matt Cumming - Provart Lab 2018  ####
#### SNP Analyses ####
library(dplyr)
library(stringr)
library("httr")
library(xml2)
library(jsonlite)
library("Biostrings")
library("tidyr")

# Can't load bioconductor packages when script is run by apache
# Load from my personal packages (should setup all dependencies to eventually do this)
library("DECIPHER", lib="/home/mcumming/R/x86_64-pc-linux-gnu-library/3.3")
source("helper_functions.R")

#### Command line AGI ids ####
gids = parseCommandLineAgis() 

# Run the following two lines to use in RStudio
#args = "AT4G34000.1,AT1G45249.1,AT1G49720.1,AT3G19290.1"
#args = "AT4G34000.1"
#gids = unlist(str_extract_all(args, 'AT[0-9]G[0-9]+[.]?[0-9]?'))

#### Get our variants from the Polymorph1001 API ####
variants = getVariants(gids)
variantStatus = getStatus(variants)
success = names(variantStatus)[variantStatus == 200]
data = formatVariants(variants)	# Parse JSON (slow)

#### Calculate frequencies ####
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
#### Alignment ####
raw_seqs = getProteinSeqs(success)
if (length(raw_seqs) == 1) {
	aligned_seqs = AAStringSet(raw_seqs) # Don't align one sequence
#		tree = NULL
} else {
	#writeXStringSet(AAStringSet(raw_seqs), format = "fasta", filepath = "temp.fas", append = FALSE )
	#system("mafft --quiet --treeout temp.fas > out.fas")		
	#aligned_seqs = readAAStringSet("out.fas")
	aligned_seqs = AlignSeqs(AAStringSet(raw_seqs), verbose = FALSE)
}
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

#### Domain Annotations ####
pfam_domains = getPfamDomains(raw_seqs)		# Pfam
cdd_residues = getCddDomains(raw_seqs)		# Conserved Domain Database

if (nrow(pfam_domains) > 0 && nrow(cdd_residues) > 0) {
  
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
  
} else if ( is.null(nrows(cdd_residues)) && (nrows(pfam_domains)) > 0) {
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
  
  
} else if ( !is.NULL(nrows(cdd_residues)) && is.NULL(nrows(pfam_domains))) {
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
} else if (is.null(pfam_domains) && is.null(cdd_residues)) {
  cdd_pfam = list()
}


toJSON(list(data=list(c(cdd_pfam), c(variantMap), c(frequency_data))), pretty = TRUE, na = 'null')
