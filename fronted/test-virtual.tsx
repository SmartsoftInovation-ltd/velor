import React from 'react';
import { renderToString } from 'react-dom/server';
import { useVirtualizer } from '@tanstack/react-virtual';

const TestComponent = () => {
  const parentRef = React.useRef(null);
  const virtualizer = useVirtualizer({
    count: 10,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 65,
  });
  
  console.log("type of getVirtualItems:", typeof virtualizer.getVirtualItems);
  console.log("return type of getVirtualItems:", Array.isArray(virtualizer.getVirtualItems()));
  
  return <div>Test</div>;
};

renderToString(<TestComponent />);
