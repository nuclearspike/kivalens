import React, { useCallback, useState, forwardRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import Form from 'react-jsonschema-form-bs4';
import { Handles, Rail, Slider, Ticks, Tracks } from 'react-compound-slider';
import HoverOver from '../Common/HoverOver';
import ModalLink from '../Modal/ModalLink';
import { Button, Dropdown } from '../bs';
import { ClickLink } from '../Links';
import { Handle, Tick, TooltipRail, Track } from './MinMaxSlider';

// /////// My STUFF VVV

const sliderStyle = {
  position: 'relative',
  width: '100%',
};

// const defaultValues = [15, 50];

const nanToUndef = val => (Number.isNaN(val) ? undefined : val); // || val === null
const prepForComp = (val, def) => nanToUndef(val) || def;
const prepToStore = (val, def) => (val === def ? null : val);

// const CustomToggle = forwardRef(({ children, onClick }, ref) => (
//   <ClickLink ref={ref} onClick={onClick}>
//     {children}
//     &#x25bc;
//   </ClickLink>
// ));

const CustomToggle = React.forwardRef(({ children, onClick }, ref) => (
  <small>
    <a
      href=""
      ref={ref}
      onClick={e => {
        e.preventDefault();
        onClick(e);
      }}
    >
      {children}
      &#x25bc;
    </a>
  </small>
));

CustomToggle.displayName = 'CustomToggle';

const schemaModal = {
  type: 'object',
  properties: {
    min_value: {
      type: 'number',
      title: 'Min Value',
    },
    max_value: {
      type: 'number',
      title: 'Max Value',
    },
  },
};

const uiSchemaModal = {
  min_value: {
    'ui:widget': 'updown',
    'ui:autofocus': true,
    'ui:placeholder': 'Input value or leave blank to have no specific minimum',
  },
  max_value: {
    'ui:widget': 'updown',
    'ui:placeholder': 'Input value or leave blank to have no specific maximum',
  },
};

const MinMaxField = ({ schema, formData, onChange }) => {
  const { min: storedMin, max: storedMax } = formData;
  const [modalFormData, setModalFormData] = useState({
    min_value: storedMin,
    max_value: storedMax,
  });
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
  const [update, setUpdate] = useState(valuesForComp);
  const [updateMin, updateMax] = update;
  const displayUpdateMin = prepToStore(updateMin, schema.min) || 'min';
  const displayUpdateMax = prepToStore(updateMax, schema.max) || 'max';

  const userAlteredCB = useCallback(
    newValues => {
      const [min, max] = newValues;
      const minToStore = prepToStore(min, schema.min);
      const maxToStore = prepToStore(max, schema.max);
      if (minToStore !== storedMin || maxToStore !== storedMax) {
        onChange({ min: minToStore, max: maxToStore });
      }
      setModalFormData({ min_value: minToStore, max_value: maxToStore });
      setUpdate([minToStore, maxToStore]); // misbehaves if not last
    },
    [onChange, storedMin, storedMax, setModalFormData],
  );

  const onModalChangeCB = useCallback(
    ({ formData: newModalFormData }) => {
      setModalFormData(newModalFormData);
    },
    [setModalFormData],
  );

  const clearValuesCB = useCallback(() => {
    userAlteredCB([null, null]);
  }, [userAlteredCB]);

  const FooterComp = useCallback(({ hideFunc }) => {
    const onClick = () => {
      userAlteredCB([modalFormData.min_value, modalFormData.max_value]);
      hideFunc();
    };
    return <Button onClick={onClick}>Save Changes</Button>;
  });

  const presetsDrop = useMemo(() => {
    return (
      schema.presets && (
        <div
          style={{
            paddingRight: 10,
          }}
        >
          <Dropdown>
            <Dropdown.Toggle
              as={CustomToggle}
              id={`${schema.title}-dropdown-presets`}
            >
              presets
            </Dropdown.Toggle>

            <Dropdown.Menu>
              {schema.presets.map(({ name, min, max }) => (
                <Dropdown.Item
                  key={name}
                  onSelect={() => userAlteredCB([min, max])}
                >
                  {name}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>
        </div>
      )
    );
  }, [schema.presets, userAlteredCB]);

  // const modalData = useMemo(() => {
  //   return {
  //     min_value: displayMin,
  //     max_value: displayMax,
  //   };
  // }, [displayMin, displayMax]);

  return (
    <>
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          flexWrap: 'nowrap',
          marginBottom: 15,
        }}
      >
        <div style={{ minWidth: 30 }}>
          <HoverOver title={schema.title} description={schema.description} />
        </div>
        <div style={{ flex: 1 }} />
        {presetsDrop}
        <div
          style={{
            // textAlign: 'right',
            paddingRight: 10,
            color: 'darkolivegreen',
          }}
        >
          {(displayUpdateMin !== displayMin ||
            displayUpdateMax !== displayMax) && (
            <small>
              {displayUpdateMin}-{displayUpdateMax}
            </small>
          )}
        </div>
        {/* <div style={{ paddingRight: 10 }}> */}

        {/* </div> */}
        <div style={{ paddingRight: 10 }}>
          <ModalLink
            linkText={`${displayMin} - ${displayMax}`}
            linkTitle={`Edit ${schema.title} values in popup.`}
            title={`Edit ${schema.title}`}
            FooterComp={FooterComp}
          >
            <p>
              Valid Range: {schema.min} through {schema.max}
            </p>
            <Form
              schema={schemaModal}
              uiSchema={uiSchemaModal}
              onChange={onModalChangeCB}
              formData={modalFormData}
            >
              {' '}
            </Form>
          </ModalLink>
        </div>
        <div>
          <small>
            <ClickLink
              title={`Reset values to defaults for ${schema.title}.`}
              onClick={clearValuesCB}
            >
              clear
            </ClickLink>
          </small>
        </div>
      </div>

      <div style={{ marginTop: 20, height: 50, width: '100%' }}>
        <Slider
          mode={1}
          step={schema.step || 1}
          rootStyle={sliderStyle}
          domain={domain}
          reversed={reversed}
          onUpdate={setUpdate}
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
    presets: PropTypes.arrayOf(
      PropTypes.shape({
        name: PropTypes.string,
        min: PropTypes.number,
        max: PropTypes.number,
      }),
    ),
  }).isRequired,
  formData: PropTypes.shape({
    min: PropTypes.number,
    max: PropTypes.number,
  }).isRequired,
  onChange: PropTypes.func.isRequired,
};

export default MinMaxField;
