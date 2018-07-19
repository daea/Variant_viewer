<?php

/**
 * This program returns the HTML output from Matt Cumming's R script.
 * Author: Vincent, Asher
 * Date: May, 2018
 * Usage: http://bar.utoronto.ca/~vlau/variantsViz/plotVariants.php?locus=at1g10000,at2g10000
 */

/**
 * This function test input data. This function is from w3c schools.
 * @param $data string from url
 * @return string html processed
 */

function test_input($data) {
    $data = trim($data);
    $data = stripslashes($data);
    $data = htmlspecialchars($data);
    return $data;
}

/**
 * This function Validates gene IDs.
 * @param $locus string Gene ID
 * @return bool true if gene is valid
 */
function is_locus_valid($locus) {
    if (preg_match('/^at[12345mc]g\d{5}\.*\d*$/i', $locus)) {
        return true;
    } else {
        echo('AGI format is invalid');
    }
}


/**
 * The main function
 */
function main() {
    header('Content-Type: text/html');

    if ($_SERVER['REQUEST_METHOD'] == 'GET') {
        if (! empty($_GET['locus'])) {
            $loci = test_input($_GET['locus']);
            $loci = explode(",", $loci);
            $execString = "Rscript cleanData.R ";
            $validAGIs = true;
            foreach($loci as $locus){
                if (is_locus_valid($locus)) {
                    $execString .= "$locus,";
                } 
                else {
                    $validAGIs = false;
				}
            }
            
            if ($validAGIs){
                $output = [];
                $execString = substr($execString, 0, -1); #remove last ','
				#$execString .= " 2>&1"; // Matt: trying to redirect all output  
					// echo($execString); #test 
                exec($execString, $output);
                foreach($output as $line){
                    echo($line);
				}
            }

        } 
        else {
            echo('No Locus provided');
        }
    }
}

// Call main function
main();

?>
