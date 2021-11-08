import React, {Component, useState} from 'react'
import PropTypes from 'prop-types'
import {Handles, Rail, Slider, Ticks, Tracks} from 'react-compound-slider'
import HoverOver from '../Common/HoverOver'

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
}

const railCenterStyle = {
  position: 'absolute',
  width: '100%',
  transform: 'translate(0%, -50%)',
  height: 14,
  borderRadius: 7,
  cursor: 'pointer',
  pointerEvents: 'none',
  backgroundColor: 'rgb(155,155,155)',
}

export class TooltipRail extends Component {
  state = {
    value: null,
    percent: null,
  }

  onMouseEnter = () => {
    document.addEventListener('mousemove', this.onMouseMove)
  }

  onMouseLeave = () => {
    this.setState({value: null, percent: null})
    document.removeEventListener('mousemove', this.onMouseMove)
  }

  onMouseMove = e => {
    const {activeHandleID, getEventData} = this.props

    if (activeHandleID) {
      this.setState({value: null, percent: null})
    } else {
      this.setState(getEventData(e))
    }
  }

  render() {
    const {value, percent} = this.state
    const {activeHandleID, getRailProps} = this.props

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
        <div style={railCenterStyle}/>
      </>
    );
  }
}

TooltipRail.propTypes = {
  getEventData: PropTypes.func,
  activeHandleID: PropTypes.string,
  getRailProps: PropTypes.func.isRequired,
}

TooltipRail.defaultProps = {
  disabled: false,
}

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
}

const railInnerStyle = {
  position: 'absolute',
  width: '100%',
  height: 14,
  transform: 'translate(0%, -50%)',
  borderRadius: 7,
  pointerEvents: 'none',
  backgroundColor: 'rgb(155,155,155)',
}

export function SliderRail({getRailProps}) {
  return (
    <>
      <div style={railOuterStyle} {...getRailProps()} />
      <div style={railInnerStyle}/>
    </>
  )
}

SliderRail.propTypes = {
  getRailProps: PropTypes.func.isRequired,
}

// *******************************************************
// HANDLE COMPONENT
// *******************************************************
export class Handle extends Component {
  state = {mouseOver: false}

  onMouseEnter = () => {
    this.setState({mouseOver: true})
  }

  onMouseLeave = () => {
    this.setState({mouseOver: false})
  }

  render() {
    const {
      domain: [min, max],
      handle: {id, value, percent},
      isActive,
      disabled,
      getHandleProps,
    } = this.props
    const {mouseOver} = this.state

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
            onMouseEnter: this.onMouseEnter,
            onMouseLeave: this.onMouseLeave,
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
  }
}

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
}

Handle.defaultProps = {
  disabled: false,
}

// *******************************************************
// TRACK COMPONENT
// *******************************************************
export function Track({source, target, getTrackProps, disabled}) {
  return (
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
  )
}

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
}

// *******************************************************
// TICK COMPONENT
// *******************************************************
export function Tick({tick, count, format}) {
  return (
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
}

Tick.propTypes = {
  tick: PropTypes.shape({
    id: PropTypes.string.isRequired,
    value: PropTypes.number.isRequired,
    percent: PropTypes.number.isRequired,
  }).isRequired,
  count: PropTypes.number.isRequired,
  format: PropTypes.func.isRequired,
}

Tick.defaultProps = {
  format: d => d,
}

// /////// My STUFF VVV

const sliderStyle = {
  position: 'relative',
  width: '100%',
}

const defaultValues = [15, 50]

const MinMaxField = ({schema, formData}) => {
  const [domain, setDomain] = useState([schema.min, schema.max])
  const [values, setValues] = useState(defaultValues.slice())
  const [update, setUpdate] = useState(defaultValues.slice())
  const [reversed, setReversed] = useState(false)
  return (
    <>
      <HoverOver title={schema.title} description={schema.description}/>
      <div>{JSON.stringify(values)}</div>
      <div>{JSON.stringify(update)}</div>
      <div style={{height: 150, width: '100%'}}>
        <Slider
          mode={1}
          step={schema.step || 1}
          rootStyle={sliderStyle}
          domain={domain}
          reversed={reversed}
          onUpdate={setUpdate}
          onChange={setValues}
          values={values}
        >
          <Rail>{railProps => <TooltipRail {...railProps} />}</Rail>
          <Handles>
            {({handles, activeHandleID, getHandleProps}) => (
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
            {({tracks, getTrackProps}) => (
              <div className="slider-tracks">
                {tracks.map(({id, source, target}) => (
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
            {({ticks}) => (
              <div className="slider-ticks">
                {ticks.map(tick => (
                  <Tick key={tick.id} tick={tick} count={ticks.length}/>
                ))}
              </div>
            )}
          </Ticks>
        </Slider>
      </div>
    </>
  );
};

export default MinMaxField
