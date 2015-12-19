import React from 'react'
import Reflux from 'reflux'
import {Grid,Col,Row} from 'react-bootstrap'


const Live = React.createClass({
    mixins: [Reflux.ListenerMixin],
    getInitialState() {
        return {}
    },
    componentDidMount() {

    },
    render() {
        return (
            <div>
                LIVE!
            </div>
        );
    }
})

export default Live