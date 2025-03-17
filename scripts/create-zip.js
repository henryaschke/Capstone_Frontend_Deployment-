import { createWriteStream } from 'fs';
import { exec } from 'child_process';
import archiver from 'archiver';

const output = createWriteStream('frontend.zip');
const archive = archiver('zip', {
  zlib: { level: 9 }
});

output.on('close', () => {
  console.log('Archive created successfully');
});

archive.on('error', (err) => {
  throw err;
});

archive.pipe(output);

// Add all files except node_modules, .git, and .bolt
archive.glob('**/*', {
  ignore: ['node_modules/**', '.git/**', '.bolt/**', 'frontend.zip']
});

archive.finalize();