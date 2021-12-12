import React from 'react';
import PT from 'prop-types';
import cx from 'classnames';
import { useStateSetterCallbacks } from '../../store/helpers/hooks';
import s from './KivaImage.css';

// eslint-disable-next-line camelcase
const KivaImage = ({
  loan,
  imageId: imageIdProp,
  width,
  imageWidth,
  height,
  type,
  useThumbAsBackground,
}) => {
  // eslint-disable-next-line camelcase
  const imageId = loan ? loan.image.id : imageIdProp;
  const [loaded, setLoaded] = useStateSetterCallbacks(false, [true]);

  const altText = loan ? loan.name : '';

  const urlImageWidth = imageWidth || width;

  const imageDir =
    type === 'square' ? `s${urlImageWidth}` : `w${urlImageWidth}`;

  const imageUrl = `https://www.kiva.org/img/${imageDir}/${imageId}.jpg`;
  const loadingImageUrl = useThumbAsBackground
    ? `https://www.kiva.org/img/s113/${imageId}.jpg`
    : `https://www.kiva.org/img/${imageDir}/726677.jpg`;

  const style = !loaded ? { backgroundImage: `url("${loadingImageUrl}")` } : {};

  return (
    <div
      className={cx(s.KivaImage, {
        [s.loaded]: loaded,
        [s.not_loaded]: !loaded,
      })}
      style={style}
    >
      {/* <div className="loading_notice">Larger version loading...</div> */}
      <img
        width={width}
        height={height}
        onLoad={setLoaded}
        alt={altText}
        src={imageUrl}
      />
    </div>
  );
};

KivaImage.propTypes = {
  loan: PT.shape({
    name: PT.string,
    image: PT.shape({
      id: PT.number,
    }),
  }),
  imageId: PT.number,
  width: PT.oneOfType([PT.number, PT.string]),
  imageWidth: PT.number,
  height: PT.number,
  type: PT.string,
  useThumbAsBackground: PT.bool,
};

KivaImage.defaultProps = {
  loan: null,
  imageId: null,
  useThumbAsBackground: false,
  type: 'width',
  width: 100,
  imageWidth: null,
  height: null,
};

export default KivaImage;
