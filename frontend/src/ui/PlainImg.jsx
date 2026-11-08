import { forwardRef } from 'react';

// <img> for NextUI Avatar's ImgComponent: Avatar 2.0.x forwards `disableAnimation`
// to its image element, which React warns about. Drop it here.
const PlainImg = forwardRef(function PlainImg(props, ref) {
    const domProps = { ...props };
    delete domProps.disableAnimation;
    return <img ref={ref} {...domProps} />;
});

export default PlainImg;
