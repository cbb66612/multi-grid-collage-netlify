const assert=require('node:assert/strict');
const {plan,placement}=require('../assets/collage-layout-v16.js');
const layouts=['auto','columns-2','columns-3','row','column','focus-left','focus-top'];
const ratios=['auto',1,4/3,3/2,16/9,9/16,3/4,2/3];
let cases=0;
for(let count=2;count<=9;count++) for(const layout of layouts) for(const ratio of ratios){
  for(const gap of [0,17,100]){
    const sizes=Array.from({length:count},(_,i)=>({width:i===count-1?300:1200,height:i===count-1?150:600}));
    const result=plan(count,{layout,ratio,gap,longEdge:2048,sizes});
    assert.equal(result.cells.length,count);
    assert.equal(Math.max(result.width,result.height),2048);
    for(const cell of result.cells){
      assert(cell.width>0&&cell.height>0);
      assert(cell.x>=0&&cell.y>=0&&cell.x+cell.width<=result.width&&cell.y+cell.height<=result.height);
      const cover=placement(300,150,cell,'cover');
      assert.equal(cover.dw,cell.width); assert.equal(cover.dh,cell.height);
      assert(cover.sx>=-1e-8&&cover.sy>=-1e-8&&cover.sx+cover.sw<=300+1e-8&&cover.sy+cover.sh<=150+1e-8);
    }
    for(let i=0;i<count;i++) for(let j=i+1;j<count;j++){
      const a=result.cells[i],b=result.cells[j];
      assert(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y,'cells overlap');
    }
    if(gap===0) assert.equal(result.cells.reduce((area,c)=>area+c.width*c.height,0),result.width*result.height,'unused canvas space');
    cases++;
  }
}
const four=plan(4,{longEdge:2048,sizes:[{width:1200,height:600},{width:1000,height:500},{width:1400,height:700},{width:300,height:150}]});
assert.equal(four.width,2048); assert.equal(four.height,1024);
assert.deepEqual(four.cells[3],{x:1024,y:512,width:1024,height:512});
assert.equal(placement(300,150,four.cells[3]).dw,1024,'small fourth image must upscale to fill');
const portrait=plan(4,{ratio:9/16,longEdge:2048});
assert.equal(portrait.width,1152); assert.equal(portrait.height,2048);
const largest=plan(9,{ratio:1,longEdge:16000});
assert(largest.width*largest.height<=250000000,'respect export pixel limit');
const contain=placement(300,150,{x:0,y:0,width:512,height:512},'contain');
assert.equal(contain.dw,512); assert.equal(contain.dh,256); assert.equal(contain.dy,128);
console.log(`Passed ${cases} count/layout/ratio/gap combinations, mixed-resolution four-image regression, portrait ratio, and complete-image fit.`);
