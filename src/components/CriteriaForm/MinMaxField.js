import React, { Component, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Handles, Rail, Slider, Ticks, Tracks } from 'react-compound-slider';
import HoverOver from '../Common/HoverOver';
import { useStateSetterCallbacks } from '../../store/helpers/hooks';

// *******************************************************
// TOOLTIP RAIL
// *******************************************************
const railStyle = {
  position: 'absolute',
  width: '100%',
  transform: 'translate(0%, -50%)',
  height: 40,
  cursor: 'pointer',
  zIndex: 300,
  // border: '1px solid grey',
};

const railCenterStyle = {
  position: 'absolute',
  width: '100%',
  transform: 'translate(0%, -50%)',
  height: 14,
  borderRadius: 7,
  cursor: 'pointer',
  pointerEvents: 'none',
  backgroundColor: 'rgb(155,155,155)',
};

export class TooltipRail extends Component {
  state = {
    value: null,
    percent: null,
  };

  onMouseEnter = () => {
    document.addEventListener('mousemove', this.onMouseMove);
  };

  onMouseLeave = () => {
    this.setState({ value: null, percent: null });
    document.removeEventListener('mousemove', this.onMouseMove);
  };

  onMouseMove = e => {
    const { activeHandleID, getEventData } = this.props;

    if (activeHandleID) {
      this.setState({ value: null, percent: null });
    } else {
      this.setState(getEventData(e));
    }
  };

  render() {
    const { value, percent } = this.state;
    const { activeHandleID, getRailProps } = this.props;

    return (
      <>
        {!activeHandleID && value ? (
          <div
            style={{
              left: `${percent}%`,
              position: 'absolute',
              marginLeft: '-11px',
              marginTop: '-35px',
            }}
          >
            <div className="tooltip">
              <span className="tooltiptext">Value: {value}</span>
            </div>
          </div>
        ) : null}
        <div
          style={railStyle}
          {...getRailProps({
            onMouseEnter: this.onMouseEnter,
            onMouseLeave: this.onMouseLeave,
          })}
        />
        <div style={railCenterStyle} />
      </>
    );
  }
}

TooltipRail.propTypes = {
  getEventData: PropTypes.func,
  activeHandleID: PropTypes.string,
  getRailProps: PropTypes.func.isRequired,
};

TooltipRail.defaultProps = {
  disabled: false,
};

// *******************************************************
// SLIDER RAIL (no tooltips)
// *******************************************************
const railOuterStyle = {
  position: 'absolute',
  transform: 'translate(0%, -50%)',
  width: '100%',
  height: 42,
  borderRadius: 7,
  cursor: 'pointer',
  // border: '1px solid grey',
};

const railInnerStyle = {
  position: 'absolute',
  width: '100%',
  height: 14,
  transform: 'translate(0%, -50%)',
  borderRadius: 7,
  pointerEvents: 'none',
  backgroundColor: 'rgb(155,155,155)',
};

export const SliderRail = ({ getRailProps }) => (
  <>
    <div style={railOuterStyle} {...getRailProps()} />
    <div style={railInnerStyle} />
  </>
);

SliderRail.propTypes = {
  getRailProps: PropTypes.func.isRequired,
};

// *******************************************************
// HANDLE COMPONENT
// *******************************************************
export const Handle = ({
  domain: [min, max],
  handle: { id, value, percent },
  isActive,
  disabled,
  getHandleProps,
}) => {
  const [mouseOver, onMouseEnter, onMouseLeave] = useStateSetterCallbacks(
    false,
    [true, false],
  );

  return (
    <>
      {(mouseOver || isActive) && !disabled ? (
        <div
          style={{
            left: `${percent}%`,
            position: 'absolute',
            marginLeft: '-11px',
            marginTop: '-35px',
          }}
        >
          <div className="tooltip">
            <span className="tooltiptext">Value: {value}</span>
          </div>
        </div>
      ) : null}
      <div
        style={{
          left: `${percent}%`,
          position: 'absolute',
          transform: 'translate(-50%, -50%)',
          WebkitTapHighlightColor: 'rgba(0,0,0,0)',
          zIndex: 400,
          width: 26,
          height: 42,
          cursor: 'pointer',
          // border: '1px solid grey',
          backgroundColor: 'none',
        }}
        {...getHandleProps(id, {
          onMouseEnter,
          onMouseLeave,
        })}
      />
      <div
        role="slider"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        style={{
          left: `${percent}%`,
          position: 'absolute',
          transform: 'translate(-50%, -50%)',
          WebkitTapHighlightColor: 'rgba(0,0,0,0)',
          zIndex: 300,
          width: 24,
          height: 24,
          border: 0,
          borderRadius: '50%',
          boxShadow: '1px 1px 1px 1px rgba(0, 0, 0, 0.2)',
          backgroundColor: disabled ? '#666' : '#8b6068',
        }}
      />
    </>
  );
};

Handle.propTypes = {
  domain: PropTypes.array.isRequired,
  handle: PropTypes.shape({
    id: PropTypes.string.isRequired,
    value: PropTypes.number.isRequired,
    percent: PropTypes.number.isRequired,
  }).isRequired,
  getHandleProps: PropTypes.func.isRequired,
  isActive: PropTypes.bool.isRequired,
  disabled: PropTypes.bool,
};

Handle.defaultProps = {
  disabled: false,
};

// *******************************************************
// TRACK COMPONENT
// *******************************************************
export const Track = ({ source, target, getTrackProps, disabled }) => (
  <div
    style={{
      position: 'absolute',
      transform: 'translate(0%, -50%)',
      height: 14,
      zIndex: 1,
      backgroundColor: disabled ? '#999' : '#8b6068',
      borderRadius: 7,
      cursor: 'pointer',
      left: `${source.percent}%`,
      width: `${target.percent - source.percent}%`,
    }}
    {...getTrackProps()}
  />
);

Track.propTypes = {
  source: PropTypes.shape({
    id: PropTypes.string.isRequired,
    value: PropTypes.number.isRequired,
    percent: PropTypes.number.isRequired,
  }).isRequired,
  target: PropTypes.shape({
    id: PropTypes.string.isRequired,
    value: PropTypes.number.isRequired,
    percent: PropTypes.number.isRequired,
  }).isRequired,
  getTrackProps: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

Track.defaultProps = {
  disabled: false,
};

// *******************************************************
// TICK COMPONENT
// *******************************************************
export const Tick = ({ tick, count, format }) => (
  <div>
    <div
      style={{
        position: 'absolute',
        marginTop: 17,
        width: 1,
        height: 5,
        backgroundColor: 'rgb(200,200,200)',
        left: `${tick.percent}%`,
      }}
    />
    <div
      style={{
        position: 'absolute',
        marginTop: 25,
        fontSize: 10,
        textAlign: 'center',
        marginLeft: `${-(100 / count) / 2}%`,
        width: `${100 / count}%`,
        left: `${tick.percent}%`,
      }}
    >
      {format(tick.value)}
    </div>
  </div>
);

Tick.propTypes = {
  tick: PropTypes.shape({
    id: PropTypes.string.isRequired,
    value: PropTypes.number.isRequired,
    percent: PropTypes.number.isRequired,
  }).isRequired,
  count: PropTypes.number.isRequired,
  format: PropTypes.func,
};

Tick.defaultProps = {
  format: d => d,
};

// /////// My STUFF VVV

const sliderStyle = {
  position: 'relative',
  width: '100%',
};

// const defaultValues = [15, 50];

const nanToUndef = val => (Number.isNaN(val) || val === null ? undefined : val);
const prepForComp = (val, def) => nanToUndef(val) || def;
const prepToStore = (val, def) => (val === def ? undefined : val);

const MinMaxField = ({ schema, formData, onChange }) => {
  const { min: storedMin, max: storedMax } = formData;
  const domain = [schema.min, schema.max];
  const reversed = false;
  const valuesForComp = [
    prepForComp(storedMin, schema.min),
    prepForComp(storedMax, schema.max),
  ];

  const displayMin = prepToStore(storedMin, schema.min) || 'min';
  const displayMax = prepToStore(storedMax, schema.max) || 'max';

  // const [domain, setDomain] = useState([schema.min, schema.max]);
  // const [valuesForComp, setValues] = useState([storedMin, storedMax]);
  // const [update, setUpdate] = useState(defaultValues.slice());
  // const [reversed, setReversed] = useState(false);

  const userAlteredCB = useCallback(
    newValues => {
      const [min, max] = newValues;
      const minToStore = prepToStore(min, schema.min);
      const maxToStore = prepToStore(max, schema.max);
      if (minToStore !== storedMin || maxToStore !== storedMax) {
        onChange({ min: minToStore, max: maxToStore });
      }
    },
    [onChange, storedMin, storedMax],
  );

  return (
    <>
      <HoverOver title={schema.title} description={schema.description} />
      <div>
        <small>
          {displayMin}-{displayMax}
        </small>
      </div>
      <div style={{ marginTop: 10, height: 50, width: '100%' }}>
        <Slider
          mode={1}
          step={schema.step || 1}
          rootStyle={sliderStyle}
          domain={domain}
          reversed={reversed}
          // onUpdate={setUpdate}
          onChange={userAlteredCB}
          values={valuesForComp}
        >
          <Rail>{railProps => <TooltipRail {...railProps} />}</Rail>
          <Handles>
            {({ handles, activeHandleID, getHandleProps }) => (
              <div className="slider-handles">
                {handles.map(handle => (
                  <Handle
                    key={handle.id}
                    handle={handle}
                    domain={domain}
                    isActive={handle.id === activeHandleID}
                    getHandleProps={getHandleProps}
                  />
                ))}
              </div>
            )}
          </Handles>
          <Tracks left={false} right={false}>
            {({ tracks, getTrackProps }) => (
              <div className="slider-tracks">
                {tracks.map(({ id, source, target }) => (
                  <Track
                    key={id}
                    source={source}
                    target={target}
                    getTrackProps={getTrackProps}
                  />
                ))}
              </div>
            )}
          </Tracks>
          <Ticks count={10}>
            {({ ticks }) => (
              <div className="slider-ticks">
                {ticks.map(tick => (
                  <Tick key={tick.id} tick={tick} count={ticks.length} />
                ))}
              </div>
            )}
          </Ticks>
        </Slider>
      </div>
    </>
  );
};

MinMaxField.propTypes = {
  schema: PropTypes.shape({
    title: PropTypes.string,
    description: PropTypes.string,
    min: PropTypes.number,
    max: PropTypes.number,
    step: PropTypes.number,
  }).isRequired,
  formData: PropTypes.shape({
    min: PropTypes.number,
    max: PropTypes.number,
  }).isRequired,
  onChange: PropTypes.func.isRequired,
};

export default MinMaxField;
