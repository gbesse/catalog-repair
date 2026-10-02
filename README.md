# Catalog Repair

Review WooCommerce catalog anomalies in a local web application. Export approved category fixes and evidence-backed duplicate proposals. Open-source alpha, independent of WooCommerce and TypeSafe.

## Run

Node 24 or later: `npm ci --ignore-scripts`, then `npm run demo`. Open the private loopback URL printed by the server. Core analysis, review and exports work without Jev. For optional real pair advice, set `TYPESAFE_API_KEY` and use `npm start`. Demo Jev advice explicitly returns synthetic `unknown`.

## Workflow

Export existing products from WooCommerce, then upload a UTF-8 CSV with `ID`, `Name`, `Categories`, optional `SKU`, and numbered WooCommerce attribute columns. Maximum 300 rows and 3 MB; every product needs a unique existing positive ID. Anomalies include missing categories, capitalization/spacing variants, repeated SKUs, identical normalized names and contradictory known attributes.

Reviewers approve a category correction or dismiss a finding with a reason. Export only approved `ID,Categories` rows, then use WooCommerce's CSV importer with **Update existing products**. The application never writes to your store. Comma-separated category lists and `>` hierarchy syntax remain WooCommerce's responsibility; no taxonomy IDs are guessed. Spreadsheet formula prefixes are rejected for corrected category values.

Potential duplicate records can be approved with evidence. This creates a MatchGraph relationship and an ExceptionOS reference proposal; **no merge or deletion is executed**. Conflicting attributes/SKUs require source correction and reimport or a documented dismissal. Pair advice costs one Jev call and never approves a finding automatically.

## Reused components

- **StateBridge** imports CSV with source/row provenance.
- **MatchGraph** generates candidate pairs and guards reviewed direct relationships.
- **ExceptionOS** retains scoped human-reviewed reference precedents and unexecuted proposals.
- **Decision Workbench** supplies loopback authentication, workspace leases and SQLite revision checks.

The graph's SKU is the internal WooCommerce product ID; `item`/pack size 1 describes a catalog record, not verified physical packaging. Approved relationships are scoped to `catalog-identity`. Similar titles and matching known fields do not establish compatibility for another use case.

## Validation

`npm test` exercises source identity rejection, provenance preservation, human-gated category exports, actual MatchGraph/ExceptionOS handoff, advisory-only inference, and a real Chromium review/download journey. `npm run check` checks syntax. No build or real WooCommerce write occurs. This is CSV interoperability based on the [official WooCommerce importer documentation](https://woocommerce.com/document/product-csv-importer-exporter/), not a tested WooCommerce host plugin.

Data and review history persist in `.local/catalog.sqlite`. Reviewer names are declarative in this local workspace. Export the complete review dossier for audit and retain the source CSV. Corrections do not overwrite source evidence. No admin email reporter is configured: unexpected errors are visible in the API, local error events and server stderr.

A real Jev smoke verification is recorded in [docs/live-verification.json](docs/live-verification.json). It used only synthetic examples and made no store/workflow changes.

## Offline review example

Run `npm run demo:review` after installation to inspect synthetic WooCommerce findings, approve one category correction and one duplicate proposal, and see the exact CSV update. The duplicate proposal remains unexecuted; the example neither calls Jev nor modifies a store.
