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


addError <- function(error) {
  errorList <<- error 
  return(errorList)
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

mapVariants <- function(alignedSeqs) {
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
  return(alignmentMatrix)
}