import React from 'react'
import Reflux from 'reflux'
import {Grid,Col,Row,Modal,Button} from 'react-bootstrap'
import a from '../actions'

const AlertModal = React.createClass({
    mixins: [Reflux.ListenerMixin],
    getInitialState() {
        return {show: false}
    },
    componentDidMount() {
        this.listenTo(a.utils.modal.alert, this.show)
    },
    shouldComponentUpdate(np, {show}){
        return show
    },
    show({title = "Notice", message, oKButton, cancelButton}){
        this.oKButton = oKButton
        this.setState({title, oKButton, cancelButton, message, show: true})
    },
    close(){
        this.setState({show: false})
        this.forceUpdate()
    },
    success(){
        this.oKButton.callback()
        this.close()
    },
    render() {
        let {title, oKButton, cancelButton, message, show} = this.state
        var defCancelText = oKButton ? 'Cancel' : 'Close'
        var cancelText = cancelButton ? (cancelButton.label || defCancelText) : defCancelText
        return (
            <Modal show={show} onHide={this.close}>
                <Modal.Header closeButton>
                    <Modal.Title>{title}</Modal.Title>
                </Modal.Header>

                <Modal.Body>
                    {message}
                </Modal.Body>

                <Modal.Footer>
                    <If condition={oKButton}>
                        <Button bsStyle="primary" onClick={this.success}>{oKButton.label || "OK"}</Button>
                    </If>
                    <Button onClick={this.close}>{cancelText}</Button>
                </Modal.Footer>
            </Modal>
        );
    }
})

export default AlertModal