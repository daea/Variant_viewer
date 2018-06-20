#### 2018 Matt Cumming - Provart Lab 2018  ####
#### SNP Analyses ####
suppressMessages({
library(dplyr)
library(stringr)
library("httr")
library(xml2)
library(jsonlite)
library("Biostrings")
library("tidyr")
library(ggseqlogo)
library(ggplot2)
library(plotly)
library(ggtree)
source("helper_functions.R")
})
#suppressMessages( {
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
		tree = NULL
	} else {
		writeXStringSet(AAStringSet(raw_seqs), format = "fasta", filepath = "temp.fas" )
		system("mafft --treeout temp.fas > out.fas")
		aligned_seqs = readAAStringSet("out.fas")
		tree = read.tree("temp.fas.tree")
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

	####################### Working With Plotly ###########################
	#### Whisker plot ####

	p1 <- plot_ly(frequency_data, x= ~position, y = ~av_freq, 
				  type = "bar", 
				  name = "frequency",
				  text = paste(
					paste("Position: ", frequency_data$position),
					paste("Mean Frequency: ", round(frequency_data$av_freq, 5)),
					paste("Number of nsSNPs: ", frequency_data$intraCount),
					paste("Number of proteins: ", frequency_data$interCount),
					sep = "<br>"),
				  hoverinfo = 'text'
				  
	) %>% 
		layout(showlegend = FALSE,
			   yaxis = list(
				title = "frequency",
				titlefont = list(
					font = "sans-serif",
					size = 12
				),
				tickfont = list(
					size = 10,
					font = "sans-serif"
				)),
			   xaxis = list(
				title = "Position in Multiple Sequence Alignment")
		) %>%
		add_trace(variantMap, x =~variantMap$position, y = ~variantMap$freq,
				  name = "nsSNPs",
				  type = "scatter",
				  mode = "markers",
				  marker = list(size = 5),
				  text = paste(
					paste("Gene Name:",variantMap$gene_name),
					paste("Reference: ", variantMap$original),
					paste("missense Variant: ", variantMap$variant),
					paste("Frequency: ", round(variantMap$freq, 5)),
					paste("Position:", variantMap$map),
					paste("# Accessions: ", variantMap$n),
					sep = "<br>"
				  ),
				  
				  hoverinfo = 'text'
		) 
	logo = as.character(aligned_seqs)
	p2 = ggseqlogo(logo) + theme(
								 panel.grid.major = element_blank(), 
								 panel.grid.minor = element_blank(),
								 panel.background = element_rect(fill = "grey97")
								 ) +
		theme(legend.title = element_blank(),
			  axis.text.x = element_blank(),
			  axis.text.y = element_text(size=10))
	p2 = ggplotly(p2) %>% 
		layout(yaxis = list(
				tickfont = list(
					size = 10,
					font = "sans-serif"),
				titlefont = list(
					size = 12,
					font = "sans-serif"),
				title = "bits")
		)

	p3 <- ggplot(cdd_pfam, aes(y = y, x = end_pos, fill = domain, alpha = 0.5)) +
		geom_rect(aes(y = y, x = end_pos,
					  ymin = y - 0.45, 
					  ymax = y + 0.45,
					  xmin = start_pos - 0.5,
					  xmax = end_pos - 0.5)) + 
		scale_y_continuous(
			breaks = seq(1:length(levels(cdd_pfam$gene_name))),
			labels = as.character(levels(cdd_pfam$gene_name))) + 
		theme(legend.title = element_blank(),
			  axis.title.y = element_blank())

	p3 <- ggplotly(p3) %>%
		layout(yaxis = list(
				tickfont = list(
					size = 10,
					font = "sans-serif"),
				titlefont = list(
					size = 12,
					font = "sans-serif"))
			)
		
	right_plot <- subplot(p1, p3, p2, 
			nrows = 3, 
			shareX = TRUE,
			heights = c(0.5,0.3,0.1),
			titleY = TRUE
	) 
#})
#right_plot
htmlwidgets::saveWidget(right_plot, "variant_plot.html")


#####
#	if (length(raw_seqs) > 1) {
#		phylogeny <- ggtree(tree)
#		print(file.exists('temp.fas.tree'))
#		print(read.tree("temp.fas.tree"))	
#		# Pull the labels from the tree, so we can plot them in the right order
#		
#		print(phylogeny$data)
#		
#		ids = data.frame(label = subset(phylogeny$data, isTip == TRUE)["label"],
#						 y =  subset(phylogeny$data, isTip == TRUE)["y"])		
#		
#		
#		# Convert tip labels to AGI
#		ids <- ids %>% 
#			group_by(label) %>%
#			mutate(agi = paste(str_split(label, pattern = "_")[[1]][2:3], collapse = ".")) %>%
#			arrange(y) 
#		
#		# Collect gene names from variant table
#		gene_names <- nsSNPs %>% group_by(gene_name, submission_id) %>% summarize()
#		
#		# If the gene name is null, plot the agi instead
#		ids = left_join(ids, gene_names, by = c("agi" = "submission_id"))
#		ids = mutate(ids, gene_name = ifelse(is.na(gene_name), 
#											 yes = as.character(agi), 
#											 no = as.character(gene_name)))
#		cdd_pfam <- left_join(cdd_pfam, ids, by = c("agi" = "agi"))
#		
#		# In the order they are in the ids table or else they will plot in the wrong order
#		levels(cdd_pfam$gene_name) <- ids$gene_name
#		
#	} else if (length(raw_seqs) == 1 | length(raw_seqs) < 1) {
#		
#		ids <- nsSNPs %>% group_by(gene_name, submission_id) %>% summarize()
#		names(ids) <- c("name", "agi")
#		gene_names <- ids %>% 
#			group_by(name) %>%
#			mutate( gene_name = ifelse(is.na(name), 
#									   yes = as.character(agi), 
#									   no = as.character(name)))
#		
#		cdd_pfam <- left_join(cdd_pfam, gene_names, by = c("agi" = "agi"))
#		cdd_pfam$agi <- as.factor(cdd_pfam$agi)
#		cdd_pfam$y = 1;
#		
#		# In the order they are in the ids table or else they will plot in the wrong order
#		levels(cdd_pfam$gene_name) <- as.factor(ids$name)
#	}
#####
