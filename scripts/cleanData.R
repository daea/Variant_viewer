#### 2018 Matt Cumming - Provart Lab 2018  ####
#### SNP Analyses ####

suppressMessages({
suppressWarnings({
library(dplyr)
library(stringr)
library("httr")
library(xml2)
library(jsonlite)
library("Biostrings")
library("tidyr")
library("DECIPHER", lib="/home/mcumming/R/x86_64-pc-linux-gnu-library/3.3")
source("helper_functions.R")


# Run the following two lines to use in RStudio
#args = "AT1G45249.1"
#gids = unlist(str_extract_all(args, 'AT[0-9]G[0-9]+[.]?[0-9]?'))

#### Global Error list ####
errorList = list()

#### Command line AGI ids ####
gids = parseCommandLineAgis() 

if (gids != FALSE) {

	#### Get our variants from the Polymorph1001 API ####
	variants = getVariants(gids)
	variantStatus = getVariantStatus(variants)
	success = names(variantStatus)[variantStatus == 200]
	
	if (length(success) > 0) {
		data = formatVariants(variants)	# Parse JSON (slow)

		#### Calculate frequencies ####
		nsSNPs <- calcFrequencies(data)
		#### Alignment ####
		raw_seqs = getProteinSeqs(success) #Only submit AGI id's that have variants associated with them
		nsSNPs <- filterNullSequences(nsSNPs, raw_seqs)
		if (length(raw_seqs) != 0) {

			if (length(raw_seqs) == 1) {
				aligned_seqs = AAStringSet(raw_seqs)
			} else {
				aligned_seqs = AlignSeqs(AAStringSet(raw_seqs), verbose = FALSE)
			}

			#### Map Variants ####
			variantMap = mapVariants(aligned_seqs, nsSNPs)

			#### Calculate our frequencies ####
			frequency_data = siteFrequencies(variantMap)

			#### Domain Annotations ####
			
			pfam_domains = getPfamDomains(raw_seqs)		# Pfam
			cdd_residues = getCddDomains(raw_seqs)		# Conserved Domain Database
			#print(pfam_domains)
			#print(cdd_residues)
			
			cdd_pfam = formatCddPfam(pfam_domains, cdd_residues, variantMap)

			returnData(cdd_pfam, variantMap, frequency_data, errorList)
		
		} else {
			returnErrors(errorList)
		}

	} else {
		returnErrors(errorList)
	}

} else {
	returnErrors(errorList)
}


	})
})


