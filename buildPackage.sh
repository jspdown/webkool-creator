#! /bin/bash

WK_CREATOR_PACKAGE='./'
WK_CREATOR_PACKAGE_BIN=${WK_CREATOR_PACKAGE}'bin/'

WK_CREATOR_SOURCES=${WK_CREATOR_PACKAGE}'sources/'
WK_CREATOR_TMP=${WK_CREATOR_PACKAGE}'sources/tmp/'

#bin

BIN='wkb'

#.ts compiling

echo "[SRC] .ts compiling"
	tsc --target ES5 --outDir ${WK_CREATOR_TMP} ${WK_CREATOR_SOURCES}${BIN}'.ts'
	echo '#! /usr/bin/env node' > ${WK_CREATOR_PACKAGE_BIN}${BIN}
	tr -d '\r' < ${WK_CREATOR_TMP}${BIN}'.js' >> ${WK_CREATOR_PACKAGE_BIN}${BIN}
	chmod +x ${WK_CREATOR_PACKAGE_BIN}${BIN}
    echo "compiling ${WK_CREATOR_SOURCES}${BIN}.ts"


