import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { importCatalog, reviewFinding, exportCorrections } from '../src/index.mjs';

const csv = await readFile(new URL('./woocommerce.csv', import.meta.url), 'utf8');
const imported = await importCatalog(csv);
const category = imported.findings.find((finding) => finding.type === 'category');
const candidate = imported.findings.find((finding) => finding.type === 'candidate_duplicate');
assert.ok(category && candidate);
const corrected = reviewFinding(imported, {
  findingId: category.id, action: 'approve', actor: 'Synthetic reviewer',
  note: 'Canonical taxonomy checked against the store export', category: 'Clothing > Shirts',
});
const reviewed = reviewFinding(corrected, {
  findingId: candidate.id, action: 'approve', actor: 'Synthetic reviewer',
  note: 'The physical labels and packaging match',
});
const exportFile = exportCorrections(reviewed);
assert.equal(exportFile.updates, 1);
assert.equal(reviewed.findings.find((finding) => finding.id === candidate.id).proposal.execution, 'not_executed');
console.log(JSON.stringify({ findings: imported.findings.map(({ id, type }) => ({ id, type })), approvedCategoryUpdates: exportFile.updates, categoryCsv: exportFile.csv, duplicateProposal: 'not_executed', sourceFingerprint: exportFile.sourceFingerprint }, null, 2));
