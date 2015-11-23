<?php

$file = 'http://docs.google.com/spreadsheets/d/1KP7ULBAyavnohP4h8n2J2yaXNpIRnyIXdjJj_AwtwK0/export?gid=1&format=csv';
$newfile = $_SERVER['DOCUMENT_ROOT'] . '\kivalens_org\react\data\atheist_data.csv';

if ( copy($file, $newfile) ) {
    echo $newfile;
    echo "   Copy success!";
}else{
    echo "   Copy failed.";
}

?>