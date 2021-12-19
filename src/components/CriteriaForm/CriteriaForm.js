import React, { useCallback } from 'react';
import Form from 'react-jsonschema-form-bs4';
import { useDispatch } from 'react-redux';
import { useCriteria } from '../../store/helpers/hooks';
import { alterCriteriaDebounce } from '../../actions/criteria';
import { TitleField } from './Common';
import PaneledObjectFieldTemplate from './ObjectFieldTemplate';
import { criteriaSchema, uiCriteriaSchema } from './allOptions';

const defaultFields = {
  TitleField,
};

const widgets = {};

const CriteriaForm = () => {
  const criteria = useCriteria();
  const dispatch = useDispatch();
  const onCriteriaChangeCB = useCallback(({ formData: newCriteria }) => {
    dispatch(alterCriteriaDebounce(newCriteria));
  }, []);
  return (
    <Form
      schema={criteriaSchema}
      uiSchema={uiCriteriaSchema}
      fields={defaultFields}
      widgets={widgets}
      formData={criteria}
      ObjectFieldTemplate={PaneledObjectFieldTemplate}
      onChange={onCriteriaChangeCB}
    >
      &nbsp;
    </Form>
  );
};

export default CriteriaForm;
