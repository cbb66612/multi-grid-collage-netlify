(function(root){
  'use strict';
  const median = values => {
    const sorted = values.slice().sort((a,b)=>a-b);
    const middle = Math.floor(sorted.length/2);
    return sorted.length%2 ? sorted[middle] : (sorted[middle-1]+sorted[middle])/2;
  };
  function plan(count, options={}){
    if(!Number.isInteger(count)||count<2||count>9) throw new Error('请选择 2–9 张图片');
    const layout = options.layout || 'auto';
    const sizes = options.sizes || [];
    const imageRatio = sizes.length ? median(sizes.map(s=>s.width/s.height)) : 1;
    let cols = layout==='row' ? count : layout==='column' ? 1 : layout==='columns-3' ? 3 : layout==='columns-2' ? 2 : count===2||count===3 ? count : count<=4 ? 2 : 3;
    cols = Math.min(cols,count);
    const rows = Math.ceil(count/cols);
    const focus = layout==='focus-left'||layout==='focus-top';
    const autoRatio = focus ? (layout==='focus-left' ? imageRatio*1.5 : imageRatio/1.5) : imageRatio*cols/rows;
    const ratio = options.ratio==='auto'||!options.ratio ? autoRatio : Number(options.ratio);
    if(!Number.isFinite(ratio)||ratio<=0) throw new Error('画布比例必须大于 0');
    let edge = Number(options.longEdge);
    if(!Number.isFinite(edge)||edge<=0){
      const cellWidth = sizes.length ? median(sizes.map(s=>s.width)) : 1024;
      const cellHeight = sizes.length ? median(sizes.map(s=>s.height)) : 1024;
      edge = Math.max(cellWidth*cols,cellHeight*rows);
    }
    edge = Math.max(64,Math.min(16000,Math.round(edge)));
    let width = ratio>=1 ? edge : Math.max(1,Math.round(edge*ratio));
    let height = ratio>=1 ? Math.max(1,Math.round(edge/ratio)) : edge;
    if(width*height>250000000){
      const scale=Math.sqrt(250000000/(width*height));
      width=Math.floor(width*scale); height=Math.floor(height*scale);
    }
    const gapCols = focus ? (layout==='focus-left' ? 2 : count-1) : cols;
    const gapRows = focus ? (layout==='focus-left' ? count-1 : 2) : rows;
    const gap = Math.max(0,Math.min(Math.round(Number(options.gap)||0),Math.floor(width/(gapCols*2)),Math.floor(height/(gapRows*2))));
    const cells=[];
    // Integer boundaries share exact edges: rounding cannot create seams or empty cells.
    function split(start,length,num,index){
      const usable=length-gap*(num-1);
      const a=Math.round(usable*index/num)+gap*index;
      const b=Math.round(usable*(index+1)/num)+gap*index;
      return [start+a,b-a];
    }
    if(focus){
      if(layout==='focus-left'){
        const main=Math.round((width-gap)*0.62);
        cells.push({x:0,y:0,width:main,height});
        for(let i=0;i<count-1;i++){
          const [y,h]=split(0,height,count-1,i);
          cells.push({x:main+gap,y,width:width-main-gap,height:h});
        }
      }else{
        const main=Math.round((height-gap)*0.62);
        cells.push({x:0,y:0,width,height:main});
        for(let i=0;i<count-1;i++){
          const [x,w]=split(0,width,count-1,i);
          cells.push({x,y:main+gap,width:w,height:height-main-gap});
        }
      }
    }else{
      for(let row=0,index=0;row<rows;row++){
        const rowCount=Math.min(cols,count-index);
        const [y,h]=split(0,height,rows,row);
        for(let col=0;col<rowCount;col++,index++){
          // The last row expands to the full width, including odd image counts.
          const [x,w]=split(0,width,rowCount,col);
          cells.push({x,y,width:w,height:h});
        }
      }
    }
    return {width,height,cells,gap,cols,rows,layout};
  }
  function placement(imageWidth,imageHeight,cell,fit='cover'){
    if(fit==='stretch') return {sx:0,sy:0,sw:imageWidth,sh:imageHeight,dx:cell.x,dy:cell.y,dw:cell.width,dh:cell.height};
    if(fit==='contain'){
      const scale=Math.min(cell.width/imageWidth,cell.height/imageHeight);
      const dw=imageWidth*scale,dh=imageHeight*scale;
      return {sx:0,sy:0,sw:imageWidth,sh:imageHeight,dx:cell.x+(cell.width-dw)/2,dy:cell.y+(cell.height-dh)/2,dw,dh};
    }
    const scale=Math.max(cell.width/imageWidth,cell.height/imageHeight);
    const sw=cell.width/scale,sh=cell.height/scale;
    return {sx:(imageWidth-sw)/2,sy:(imageHeight-sh)/2,sw,sh,dx:cell.x,dy:cell.y,dw:cell.width,dh:cell.height};
  }
  const api={plan,placement};
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.CollageLayout=api;
})(typeof window==='object'?window:globalThis);
