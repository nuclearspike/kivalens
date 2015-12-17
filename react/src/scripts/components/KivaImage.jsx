'use strict'
import React from 'react';

const KivaImage = React.createClass({
    getDefaultProps(){
        return {type : 'width'}
    },
    render(){
        //if loan={loan} is set to a valid API loan object, it knows how to get the image id
        var image_id = (this.props.loan) ? this.props.loan.image.id : this.props.image_id

        //set width if width is not defined (?)
        if (this.props.image_width && !this.props.width){
            this.props.width = this.props.image_width
        }

        var alt_text = (this.props.loan) ? this.props.loan.name : ''

        //supports 'square' type else it defaults to 'width'
        var image_dir = (this.props.type == 'square') ? `s${this.props.image_width}` : `w${this.props.image_width}`

        //build the URL
        var image_url = `//www.kiva.org/img/${image_dir}/${image_id}.jpg`;

        return (<img {...this.props} alt={alt_text} src={image_url} />)
    }
})

//optionally wrap it in a link? not exported at this time.
const KivaThumbnail = React.createClass({
    render(){
        return (
            <KivaImage image_width={113} {...this.props}/>
        )
    }
})

export default KivaImage;