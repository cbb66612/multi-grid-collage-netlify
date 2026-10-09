const path=require('node:path');
const fs=require('node:fs/promises');
const sharp=require(process.argv[2]||'sharp');
(async()=>{
  const root=path.resolve(__dirname,'../.finesse/collage-fixtures');
  await fs.mkdir(root,{recursive:true});
  const cases=[[1200,600,'#e45a54'],[1000,500,'#40b78a'],[1400,700,'#508bd5'],[300,150,'#efbd4f']];
  for(let i=0;i<cases.length;i++){
    const [width,height,color]=cases[i];
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${color}"/><circle cx="50%" cy="50%" r="${height/4}" fill="white"/><text x="50%" y="53%" text-anchor="middle" font-family="sans-serif" font-size="${height/4}" fill="${color}">${i+1}</text></svg>`;
    await sharp(Buffer.from(svg)).png().toFile(path.join(root,`${i+1}.png`));
  }
  console.log(root);
})().catch(error=>{console.error(error);process.exitCode=1;});
