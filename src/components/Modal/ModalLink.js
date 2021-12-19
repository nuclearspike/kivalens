import React, { memo } from 'react';
import PT from 'prop-types';
import { Button, Modal } from '../bs';
import { useStateSetterCallbacks } from '../../store/helpers/hooks';
import { ClickLink } from '../Links';

const ModalLink = memo(
  ({ linkText, title, disabled, FooterComp, children }) => {
    const [show, setShow, setHide] = useStateSetterCallbacks(false, [
      true,
      false,
    ]);

    title = title || linkText;

    return (
      <>
        <ClickLink onClick={setShow} disabled={disabled}>
          <small>{linkText}</small>
        </ClickLink>

        <Modal show={show} onHide={setHide} backdrop="static" keyboard={false}>
          <Modal.Header closeButton>
            <Modal.Title>{title}</Modal.Title>
          </Modal.Header>

          <Modal.Body>{children}</Modal.Body>

          <Modal.Footer>
            {FooterComp && <FooterComp hideFunc={setHide} />}{' '}
            <Button variant="secondary" onClick={setHide}>
              Close
            </Button>
          </Modal.Footer>
        </Modal>
      </>
    );
  },
);

ModalLink.displayName = 'ModalButton';

ModalLink.propTypes = {
  linkText: PT.string.isRequired,
  title: PT.string,
  FooterComp: PT.func.isRequired,
  children: PT.node.isRequired,
  disabled: PT.bool,
};

ModalLink.defaultProps = {
  buttonVariant: 'primary',
  disabled: false,
  title: null,
};

export default ModalLink;
