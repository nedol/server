# Data Directory

This directory contains data files used by the application.

## SUBTLEX-NL Data

To use the SUBTLEX-NL word frequency functionality, you need to obtain the SUBTLEX-NL data file and place it in this directory.

### How to obtain SUBTLEX-NL data:

1. Visit the official SUBTLEX-NL website: http://subtlex.nl/
2. Download the frequency data file (usually a TSV file)
3. Rename the file to `subtlex-nl.tsv` and place it in this directory

The expected format is a TSV (Tab-Separated Values) file with at least the following columns:
- Word: The word
- FREQcount: The frequency count of the word

Example format:
```
Word    FREQcount    CDcount    FreqPM    CDPct    Lg10WF    Lg10CD    Lg10WF_Zipf
de    23903144    10893    1000000    100    7.3784    4.0371    3.5562
en    11903144    10893    500000    100    7.0756    4.0371    3.2534
...
```

Note: The SUBTLEX-NL data is research data and may have specific licensing requirements. Please check the official website for terms of use.