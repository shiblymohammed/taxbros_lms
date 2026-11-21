import React from 'react';

// Mock ReactPlayer for testing
const ReactPlayer = React.forwardRef((props: any, ref: any) => {
  return <div data-testid="react-player" ref={ref}>Mock Video Player</div>;
});

ReactPlayer.displayName = 'ReactPlayer';

export default ReactPlayer;
