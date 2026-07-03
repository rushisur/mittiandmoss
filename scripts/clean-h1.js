import fs from 'fs';
import path from 'path';

const blogDir = path.join(process.cwd(), 'src/content/blog');
const files = fs.readdirSync(blogDir).filter(f => f.endsWith('.md') || f.endsWith('.mdx'));

for (const file of files) {
  const filePath = path.join(blogDir, file);
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Find the end of frontmatter
  const match = content.match(/^---\n[\s\S]*?\n---\n/);
  if (match) {
    const frontmatterEnd = match[0].length;
    const body = content.slice(frontmatterEnd);
    
    // Remove the first H1 that looks like `# Title` (with optional whitespace)
    const newBody = body.replace(/^\s*#\s+[^\n]+\n+/, '');
    
    // Write back if changed
    if (body !== newBody) {
      fs.writeFileSync(filePath, content.slice(0, frontmatterEnd) + newBody);
      console.log(`Cleaned duplicate H1 in ${file}`);
    }
  }
}
