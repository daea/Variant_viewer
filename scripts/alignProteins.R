#### 2018 Matt Cumming - Provart Lab 2018  ####
#### SNP Analyses ####

suppressMessages({
suppressWarnings({

library(dplyr)
library(stringr)
library("httr")
library("tidyr")
library("DECIPHER")
library(jsonlite)

source("alignmentFunctions.R")
# Run the following two lines to use in RStudio
args = "AT1G45249.1,AT4G34000.1"
gids = unlist(str_extract_all(args, 'AT[0-9]G[0-9]+[.]?[0-9]?'))

#### Global Error list ####
errorList = list()

#### Command line AGI ids ####
#gids = parseCommandLineAgis() 

if (length(gids) > 0) {
  raw_seqs = getProteinSeqs(gids) #Only submit AGI id's that have variants associated with them
  if (length(raw_seqs) == 1) {
    aligned_seqs = AAStringSet(raw_seqs)
  } else {
    aligned_seqs = AlignSeqs(AAStringSet(raw_seqs), verbose = FALSE)
    alignmentMap = mapVariants(aligned_seqs)
	}
  toJSON(list(
     data=list(
      c(alignmentMap)
     ),
     error = errorList
  )
    , pretty = TRUE, na = 'null')
} else {
	returnErrors(errorList)
}

  })
})
