import React, { memo } from 'react';
import PT from 'prop-types';
import { Button, Modal } from '../bs';
import { useStateSetterCallbacks } from '../../store/helpers/hooks';

const ModalButton = memo(
  ({ buttonText, buttonVariant, title, disabled, FooterComp, children }) => {
    const [show, setShow, setHide] = useStateSetterCallbacks(false, [
      true,
      false,
    ]);

    title = title || buttonText;

    return (
      <>
        <Button variant={buttonVariant} disabled={disabled} onClick={setShow}>
          {buttonText}
        </Button>

        <Modal show={show} onHide={setHide} backdrop="static" keyboard={false}>
          <Modal.Header closeButton>
            <Modal.Title>{title}</Modal.Title>
          </Modal.Header>

          <Modal.Body>{children}</Modal.Body>

          <Modal.Footer>
            <FooterComp hideFunc={setHide} />{' '}
            <Button variant="secondary" onClick={setHide}>
              Close
            </Button>
          </Modal.Footer>
        </Modal>
      </>
    );
  },
);

ModalButton.displayName = 'ModalButton';

ModalButton.propTypes = {
  buttonText: PT.string.isRequired,
  buttonVariant: PT.string,
  title: PT.string,
  FooterComp: PT.func.isRequired,
  children: PT.node.isRequired,
  disabled: PT.bool,
};

ModalButton.defaultProps = {
  buttonVariant: 'primary',
  disabled: false,
  title: null,
};

export default ModalButton;
