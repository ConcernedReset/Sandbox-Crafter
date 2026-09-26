// Prints the README's spoiler table of every recipe, generated from the rules
// so it can't drift out of date:  node scripts/recipe-table.js
import { COLLECTIBLE, RULES, ruleLabel, rulesFor } from '../src/sim/elements.js';

const rows = COLLECTIBLE.filter((d) => !d.start).map((d) => {
  const how = rulesFor(d.id).map((r) => ruleLabel(RULES[r])).join(' · ');
  return `| ${d.number} | ${d.name} | ${how} |`;
});
console.log(['| No. | Element | Made from |', '| --- | ------- | --------- |', ...rows].join('\n'));
