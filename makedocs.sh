#!/bin/sh

echo "WARNING: solidity-doc is crap!"

( for solfile in contracts/*.sol
  do
      node_modules/.bin/solidity-doc generate ${solfile} 2> /dev/null
  done ) \
| sed -r '/^## Functions/d;
          s/^empty list$/*none*/;
          s/\[object Object\]/mapping/;
          s/\b(param|return)0\b/---/;
          s/^#(#+)/\1/' \
| pandoc -o docs/TokenPlatform.pdf \
         --metadata title:"SICOS Token Platform" \
         --metadata author:"SICOS" \
         --variable titlepage:true \
         --from markdown+autolink_bare_uris \
         --to latex \
         --template docs/templates/eisvogel.latex \
         --toc \
         --toc-depth 3
