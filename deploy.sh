#!/bin/bash

set -eu

(cd sefaria-multiplexer && yes | gcloud --configuration sefaria-multiplexer app deploy)

appyaml=$(mktemp)
cat base_app.yaml > $appyaml
tanakh_base=$(
    gcloud app describe --configuration sefaria-multiplexer \
        | grep defaultHostname \
        | awk '{print $2}')
cat <<EOF >> $appyaml
env_variables:
  TANAKH_BASE_URL: "https://$tanakh_base"
EOF

npm run build

yes | gcloud --configuration talmud-page app deploy --appyaml $appyaml
