const fs = require('fs');

const files = [
  'src/components/sales/CreateRetailSalesForm.tsx',
  'src/components/sales/CreateWholeSalesForm.tsx'
];

const replacements = [
  { match: /\bbg-white(?!\s+dark:bg-gray-800)\b/g, replace: 'bg-white dark:bg-gray-800 dark:text-white' },
  { match: /\bbg-gray-100(?!\s+dark:bg-gray-900)\b/g, replace: 'bg-gray-100 dark:bg-gray-900' },
  { match: /\bbg-gray-50\/70(?!\s+dark:bg-gray-700\/70)\b/g, replace: 'bg-gray-50/70 dark:bg-gray-700/70' },
  { match: /\bbg-gray-50(?!\s+dark:bg-gray-700)\b/g, replace: 'bg-gray-50 dark:bg-gray-700' },
  { match: /\bbg-gray-800(?!\s+dark:bg-gray-200)\b/g, replace: 'bg-gray-800 dark:bg-gray-200' },
  { match: /\bbg-teal-50(?!\s+dark:bg-teal-900)\b/g, replace: 'bg-teal-50 dark:bg-teal-900' },
  { match: /\bhover:bg-teal-100(?!\s+dark:hover:bg-teal-800)\b/g, replace: 'hover:bg-teal-100 dark:hover:bg-teal-800' },
  { match: /\bhover:bg-blue-50(?!\s+dark:hover:bg-blue-900)\b/g, replace: 'hover:bg-blue-50 dark:hover:bg-blue-900' },
  { match: /\btext-gray-800(?!\s+dark:text-gray-100)\b/g, replace: 'text-gray-800 dark:text-gray-100' },
  { match: /\btext-gray-700(?!\s+dark:text-gray-200)\b/g, replace: 'text-gray-700 dark:text-gray-200' },
  { match: /\btext-gray-600(?!\s+dark:text-gray-300)\b/g, replace: 'text-gray-600 dark:text-gray-300' },
  { match: /\btext-gray-500(?!\s+dark:text-gray-400)\b/g, replace: 'text-gray-500 dark:text-gray-400' },
  { match: /\bborder-gray-200(?!\s+dark:border-gray-700)\b/g, replace: 'border-gray-200 dark:border-gray-700' },
  { match: /\bborder-gray-300(?!\s+dark:border-gray-600)\b/g, replace: 'border-gray-300 dark:border-gray-600' },
  { match: /\bborder-gray-100(?!\s+dark:border-gray-700)\b/g, replace: 'border-gray-100 dark:border-gray-700' },
  { match: /\bborder-gray-50(?!\s+dark:border-gray-800)\b/g, replace: 'border-gray-50 dark:border-gray-800' },
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;
  
  replacements.forEach(({ match, replace }) => {
    content = content.replace(match, replace);
  });
  
  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${file}`);
  } else {
    console.log(`No changes needed for ${file}`);
  }
});
