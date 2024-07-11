import * as React from "react";
import * as PropTypes from 'prop-types';
import {animated, useSpring} from "@react-spring/web";
import {useDrag} from "@use-gesture/react";

const {
  useState,
} = React;

interface SwipeableBackgroundParams {
  initiallyOn: boolean;
  onChange: (x: boolean) => void;
  onDoubleOn?: () => void;
  children: any;
  inline?: boolean;
  isOnRef: React.MutableRefObject;
}

const MAX_OPACITY = .4;
const MAX_DISTANCE_PIXELS = 150;

export function SwipeableBackground({
  initiallyOn,
  onChange,
  onDoubleOn,
  children,
  inline,
  isOnRef,
}: SwipeableBackgroundParams): React.ReactElement {
  const color = (ratio: number) => {
    return {backgroundColor: `rgba(87, 175, 235, ${ratio})`};
  };
  const [styles, api] = useSpring(() => color(initiallyOn ? MAX_OPACITY : 0));
  const [isOn, setIsOn] = useState(initiallyOn);
  const retrigger = useState(0)[1];
  const setBackground = (ratio: number) => { api.start(color(ratio)); };
  isOnRef.current = () => {
    if (!isOn) console.log(styles);
    retrigger(Math.random());
    setIsOn(false)
    setBackground(0);
  };

  const bind = useDrag(({offset, lastOffset, last}) => {
    let offsetX = lastOffset[0] - offset[0];
    if (isOn) {
      // If we're already highlighted, "recenter" as if we were starting the current swipe after
      // already performing a swipe in the "on" direction.
      offsetX += MAX_DISTANCE_PIXELS;
    }
    const multiplier = (isOn && onDoubleOn !== undefined) ? 2 : 1;
    const ratio = Math.min((offsetX / MAX_DISTANCE_PIXELS) * MAX_OPACITY, MAX_OPACITY * multiplier);
    const opacity = Math.max(ratio, 0);
    if (last) {
      const didChange = (isOn && ratio < 0) || (!isOn && ratio === MAX_OPACITY);
      const newState = didChange ? !isOn : isOn;
      setBackground(newState ? MAX_OPACITY : 0);
      setIsOn(newState);
      if (didChange) {
        onChange(newState);
      } else if (isOn && ratio === MAX_OPACITY * multiplier) {
        onDoubleOn();
      }
    } else {
      setBackground(opacity);
    }
  }, {
    // This effectively disables the feature on Desktop, which is probably fine as the X icon still
    // exists. We could get fancy by trying to detect the type of browser and set this value
    // accordingly... though not sure it's worth the complexity.
    pointer: {touch: true},
  });

  const ElementType = inline ? animated.span : animated.div;
  return (
    // eslint-disable-next-line react/jsx-props-no-spreading
    <ElementType {...bind()} style={styles}>
      {children}
    </ElementType>
  );
}
SwipeableBackground.propTypes = {
  children: PropTypes.object.isRequired,
  initiallyOn: PropTypes.bool.isRequired,
  onChange: PropTypes.func.isRequired,
  onDoubleOn: PropTypes.func,
  inline: PropTypes.bool,
};

interface SwipeableParams {
  onSwiped: () => void;
  children: any;
}

export function Swipeable({children, onSwiped}: SwipeableParams): React.ReactElement {
  const [{x}, api] = useSpring(() => ({x: 0}));
  const bind = useDrag(({offset: [newX], cancel, last, canceled}) => {
    api.start({x: newX});
    if (Math.abs(newX) > 150 && last && !canceled) {
      onSwiped();
      cancel();
    } else if (last) {
      api.start({x: 0});
    }
  }, {
    // This effectively disables the feature on Desktop, which is probably fine as the X icon still
    // exists. We could get fancy by trying to detect the type of browser and set this value
    // accordingly... though not sure it's worth the complexity.
    pointer: {touch: true},
  });
  return (
    // eslint-disable-next-line react/jsx-props-no-spreading
    <animated.div {...bind()} style={{x}}>
      {children}
    </animated.div>
  );
}
Swipeable.propTypes = {
  children: PropTypes.object.isRequired,
  onSwiped: PropTypes.func.isRequired,
};
