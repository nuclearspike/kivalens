'use strict'
import React from 'react'
//if you see this message, it means in your import you wrote:
// import component from '.'
//   instead of
// import {component} from '.'

class CatchNoCurlies extends React.Component {
    render() {
        console.error("YOU FORGOT CURLIES in your import statement")
        return (
            <div>YOU FORGOT CURLIES in your import statement</div>
        );
    }
}

export default CatchNoCurlies;