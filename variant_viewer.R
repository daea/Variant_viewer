#### 2018 Matt Cumming - Provart Lab 2018  ####
#### SNP Analyses ####
{
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
}

#### Command line AGI ids ####
gids = parseCommandLineAgis() 

# Run the following two lines to use in RStudio
args = "AT4G34000.1,AT1G45249.2"
args = "AT4G34000.1,AT4G34000.2,AT4G34000.3, AT1G34000.5"
gids = unlist(str_extract_all(args, 'AT[0-9]G[0-9]+[.]?[0-9]?'))


#### Get our variants from the Polymorph1001 API ####
base_url = "http://tools.1001genomes.org/api/v1.1/effects.json?type=snps;accs=all;gid="
right_url = ";effect=missense_variant"
variants = getVariants(gids, base_url, right_url)
getStatus(variants, gids)
data = formatVariants(variants)	# Parse JSON (slow)

#### Calculate frequencies ####
mutant = "p.([:alpha:]{3})([:digit:]+)([:alpha:]{3})" 	# Matches the snpEFF effect field and extracts variant info

nsSNPs = summarise(group_by(data, gene_name, amino_acid_change, transcript_id),
				   n = n()) 
nsSNPs = mutate(nsSNPs, freq = n / 1135) 				# 1135 accessions in the sample total
nsSNPs = mutate(group_by(nsSNPs, gene_name, amino_acid_change), # Split up that variant column
		   original = str_match(amino_acid_change, mutant)[2],
		   site     = as.numeric(str_match(amino_acid_change, mutant)[3]),
		   variant  = str_match(amino_acid_change, mutant)[4],
		   agi      = str_extract(transcript_id, 'AT[0-9]G[0-9]+')
	)

nsSNPs$gene_name <- as.factor(nsSNPs$gene_name)
nsSNPs$transcript_id <- as.factor(nsSNPs$transcript_id)

gene_names <- nsSNPs %>% group_by(gene_name, transcript_id) %>% summarize()


#### Request Protein Sequences ####
proturl = "http://bar.utoronto.ca/webservices/bar_araport/get_protein_sequence_by_identifier.php?locus="
prot_responses = lapply(gids, function(x) GET(paste(proturl, x, sep="")))
raw_seqs = unlist(lapply(prot_responses, function(response) content(response)$result[[1]]$sequence))
names(raw_seqs) = gids


#### Alignment ####
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
# Convert to a matrix
matrix = data.frame(t(as.matrix(aligned_seqs)))
consensus_length = c(1:nrow(matrix))
matrix = gather(matrix)
matrix$position = consensus_length

# Data cleaning and organization
temp = mutate(matrix, dummy = ifelse(value == "-",yes = 0, no = 1 ))
temp2 = mutate(group_by(temp, key),
			   value    = value, 
			   position = position,
			   map      = ifelse(dummy == 0, yes = NA, no = cumsum(dummy)),
			   agi      = str_extract(key, 'AT[0-9]G[0-9]+')
			)	

## Map variants onto Alignment for Plotting
final = left_join(x = temp2,
		  y = nsSNPs,
		  by = c("map" = "site", "agi" = "agi")
		  )

frequency_data <- final %>% 
	mutate(freq  = ifelse(is.na(freq), 0, freq),# Turn NA's into 0's
		   n     = ifelse(is.na(n), 0, n)) %>% 	# Group by position and agi 
	group_by(position, agi) %>%
	summarise(cum_freq = sum(freq),             # Calculate cumulative frequencies (diff from REF)
			  intra = sum(freq > 0))	%>%	    
	group_by(position)	%>%				      	# Group by position
	summarise(av_freq = mean(cum_freq),         # Calculate average frequencies
			  interCount = sum(cum_freq > 0),
			  intraCount = sum(intra)# Count the number of proteins with a variant
	)

#### Pfam Domains ####
## Domains for Plot Annotations
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


#### CDD Domains ####

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



#### Combine CDD and pfam Data ####

pfam_domains$startIndex <- as.numeric(as.character(pfam_domains$startIndex))
pfam_domains$endIndex <- as.numeric(as.character(pfam_domains$endIndex))

temp_start = left_join(pfam_domains, final, by = c("agi" = "key","startIndex" = "map"))
temp_start$start_pos <- temp_start$position
pfam_mapped = left_join(temp_start[c("agi", "pfam_domain", "endIndex", "start_pos","PfamAnnot", "Expect")], 
						final, 
						by = c(
							"agi" = "key",
							"endIndex" = "map")
)
pfam_mapped$end_pos <- pfam_mapped$position
pfam_mapped <- subset(pfam_mapped, select = c("agi",
											  "pfam_domain",
											  "end_pos",
											  "start_pos",
											  "PfamAnnot",
											  "Expect")
)
cdd_mapped <- left_join(cdd_residues, final, by = c("agi"= "key", "location" = "map"))
cdd_mapped <- subset(cdd_mapped, select = c("agi",
											"cdd_domain", 
											"residue", 
											"position" 
))
cdd_mapped$agi <- as.factor(cdd_mapped$agi)
cdd_mapped$domain <- cdd_mapped$cdd_domain
cdd_mapped <-cdd_mapped %>% 
	mutate(start_pos = position, 
		   end_pos = position + 1
	) %>%
	select(-c(position))
pfam_mapped$domain <- pfam_mapped$pfam_domain

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
		   	title = "frequency"),
		   xaxis = list(
		   	title = "Position in Multiple Sequence Alignment")
	) %>%
	add_trace(final, x =~final$position, y = ~final$freq,
			  name = "nsSNPs",
			  type = "scatter",
			  mode = "markers",
			  marker = list(size = 5),
			  text = paste(
			  	paste("Gene Name:",final$gene_name),
			  	paste("Reference: ", final$original),
			  	paste("missense Variant: ", final$variant),
			  	paste("Frequency: ", round(final$freq, 5)),
			  	paste("Position:", final$map),
			  	paste("# Accessions: ", final$n),
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
		  axis.text.x = element_blank()) +
	labs(y = "bits")

cdd_pfam <- full_join(pfam_mapped, cdd_mapped) %>% 
	select(-c(pfam_domain, cdd_domain))


phylogeny <- ggtree(tree)
ids = data.frame(label = subset(phylogeny$data, isTip == TRUE)["label"],
				 y =  subset(phylogeny$data, isTip == TRUE)["y"])
ids <- ids %>% 
	group_by(label) %>%
	mutate(agi = paste(str_split(label, pattern = "_")[[1]][2:3], collapse = ".")) %>%
	arrange(y)

ids = left_join(ids, gene_names, by = c("agi" = "transcript_id"))


ids = mutate(ids, gene_name = ifelse(is.na(gene_name), 
				  yes = as.character(agi), 
				  no = as.character(gene_name)))

cdd_pfam <- left_join(cdd_pfam, ids, by = c("agi" = "agi"))
cdd_pfam$agi <- as.factor(cdd_pfam$agi)
levels(cdd_pfam$gene_name) <- ids$gene_name

p3 <- ggplot(cdd_pfam, aes(y = y, x = end_pos, fill = domain, alpha = 0.5)) +
	geom_rect(aes(y = y, x = end_pos,
				  ymin = y - 0.45, 
				  ymax = y + 0.45,
				  xmin = start_pos - 0.5,
				  xmax = end_pos - 0.5)) + 
	scale_y_continuous(
		breaks = seq(1:length(levels(cdd_pfam$gene_name))),
		labels = levels(cdd_pfam$gene_name)) + 
	theme(legend.title = element_blank(),
		  axis.title.y = element_blank())
	
right_plot <- subplot(p1, p3, p2, 
		nrows = 3, 
		shareX = TRUE,
		heights = c(0.5,0.3,0.1),
		margin = 0.02,
		titleY = TRUE
) %>% layout(margin = list(l=150,t=150,r=150),
			 title = "<br><br><i>A.thaliana</i> nsSNP viewer",
			 titlefont = list(size = 16)
			 )
htmlwidgets::saveWidget(right_plot, "variant_plot.html")

