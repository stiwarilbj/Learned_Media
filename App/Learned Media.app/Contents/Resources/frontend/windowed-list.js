// Measured native DOM rows. Keep one viewport of overscan on either side.
(function(scope){
  const lists=new Set(), measurements=new Map();
  let frame=0;
  function schedule(){if(!frame)frame=requestAnimationFrame(function(){frame=0;for(const list of lists){if(!list.host.isConnected){if(list.connected){list.dispose();lists.delete(list);}continue;}list.connected=true;list.paint();}});}
  document.addEventListener('scroll',schedule,true);
  window.addEventListener('resize',schedule,{passive:true});
  function scrollParent(host){for(let parent=host.parentElement;parent;parent=parent.parentElement){if(/auto|scroll/.test(getComputedStyle(parent).overflowY) && parent.clientHeight>0)return parent;}return null;}
  function create(items,options){
    const host=document.createElement('div');host.className=options.className || '';
    host.style.position='relative';host.style.display='block';
    const rendered=new Map(); let offsets=[],keys=[],total=0,range='',raf=0;
    let columns=typeof options.columns==='function'?options.columns():options.columns || 1;const gap=options.gap == null ? 16 : options.gap;
    const cacheKey=options.cacheKey || options.className || 'list';
    let heights=measurements.get(cacheKey);if(!heights){heights=new Map();measurements.set(cacheKey,heights);}
    // Maps retain numeric heights, never cards, source text, or DOM nodes.
    while(measurements.size>16)measurements.delete(measurements.keys().next().value);
    function layout(){offsets=[0];keys=[];for(let i=0;i<items.length;i+=columns){const key=items.slice(i,i+columns).map(options.key).join('\u0000');keys.push(key);offsets.push(offsets[offsets.length-1]+(heights.get(key) || options.estimatedHeight || 400)+gap);}total=offsets[offsets.length-1];host.style.height=total+'px';}
    function rowAt(y){let low=0,high=keys.length;while(low<high){const mid=(low+high)>>>1;if(offsets[mid+1]<y)low=mid+1;else high=mid;}return Math.min(low,Math.max(0,keys.length-1));}
    const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(function(entries){
      let changed=false;const anchorTop=host.getBoundingClientRect().top;let adjustment=0;
      for(const entry of entries){const key=entry.target.dataset.windowKey;const size=entry.borderBoxSize?.[0]?.blockSize || entry.contentRect.height;if(size>0 && Math.abs((heights.get(key)||options.estimatedHeight||400)-size)>.5){const index=keys.indexOf(key);const previous=heights.get(key)||options.estimatedHeight||400;if(index>=0 && anchorTop+offsets[index+1]<0)adjustment+=size-previous;heights.set(key,size);changed=true;}}
      if(changed){layout();range='';if(adjustment){const scroll=scrollParent(host);if(scroll)scroll.scrollTop+=adjustment;else window.scrollBy(0,adjustment);}schedule();}
    });
    const list={host,connected:false,dispose:function(){if(observer)observer.disconnect();cancelAnimationFrame(raf);rendered.clear();},paint:function(){
      const nextColumns=typeof options.columns==='function'?options.columns():columns;
      if(nextColumns!==columns){columns=nextColumns;for(const row of rendered.values()){observer?.unobserve(row);row.remove();}rendered.clear();range='';layout();}
      const parent=scrollParent(host),bounds=host.getBoundingClientRect(),parentBounds=parent?parent.getBoundingClientRect():{top:0,bottom:window.innerHeight};
      const viewport=Math.max(1,Math.min(parentBounds.bottom,window.innerHeight)-Math.max(0,parentBounds.top));const top=Math.max(0,parentBounds.top)-bounds.top;
      const first=rowAt(Math.max(0,top-viewport)),last=Math.min(keys.length-1,rowAt(top+viewport*2));
      const signature=first+':'+last+':'+total;if(signature===range)return;range=signature;
      for(const [index,row] of rendered){if((index<first || index>last) && !row.contains(document.activeElement)){observer?.unobserve(row);row.remove();rendered.delete(index);}}
      const indexes=[];for(let index=first;index<=last && keys.length;index++)indexes.push(index);
      if(options.pinnedKey){const pinned=items.findIndex(function(item){return options.key(item)===options.pinnedKey;});const row=Math.floor(pinned/columns);if(pinned>=0 && !indexes.includes(row))indexes.push(row);}
      if(options.onRetainedItemsChange)options.onRetainedItemsChange(indexes.sort(function(a,b){return a-b;}).flatMap(function(index){return items.slice(index*columns,index*columns+columns);}));
      for(const index of indexes){
        let row=rendered.get(index);if(!row){row=document.createElement('div');row.dataset.windowKey=keys[index];row.style.position='absolute';row.style.left='0';row.style.right='0';row.style.display='grid';row.style.gridTemplateColumns='repeat('+columns+',minmax(0,1fr))';row.style.gap=gap+'px';
          for(const item of items.slice(index*columns,index*columns+columns))row.appendChild(options.render(item));host.appendChild(row);rendered.set(index,row);observer?.observe(row);
        }row.style.top=offsets[index]+'px';
      }
    }};
    layout();lists.add(list);raf=requestAnimationFrame(function(){list.paint();schedule();});return host;
  }
  scope.LEARNED_MEDIA_WINDOWED={create,schedule};
})(globalThis);
