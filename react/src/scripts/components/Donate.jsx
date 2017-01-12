'use strict'
import React, {Component, PropTypes} from 'react';
import {Grid, Col, Row, Panel} from 'react-bootstrap';
import {NewTabLink} from '.'


const Item = ({title, children}) => {
    return <Panel header={title}>
        {children}
    </Panel>
}

class Donate extends Component {
    render() {
        return (
            <Grid className="donatePage">
                <h1>Donate</h1>
                <h4>
                    KivaLens is now and will always be free to use for everyone.
                    KivaLens is <i>not</i> a non-profit, so your donations are <i>not</i> tax deductible.
                    If you find this site useful and would like to contribute anything to
                    server or development costs, there are a few options. Thanks to everyone
                    who has donated to help keep this running!
                </h4>
                <Item title="PayPal">
                    <NewTabLink className="btn btn-default" href="https://paypal.me/nuclearspike">Pay Pal Me</NewTabLink> You're already using
                    PayPal for Kiva, so this will probably be the easiest for most.
                </Item>
                <Item title="Kiva Gift Card">
                    <NewTabLink className="btn btn-default" href="https://www.kiva.org/gifts/kiva-cards?handle=nuclearspike#/lender">
                        Send Kiva Gift Card
                    </NewTabLink>
                </Item>
                <Item title="Amazon Gift Card">
                    <NewTabLink
                        className="btn btn-default"
                        href="https://www.amazon.com/gp/product/B0145WHYKC/ref=s9_acss_bw_cg_gclptcg_2a1_w?pf_rd_m=ATVPDKIKX0DER&pf_rd_s=merchandised-search-1&pf_rd_r=QHK9D4T7YV04CC6XSHGF&pf_rd_t=101&pf_rd_p=15631faf-d88b-41d2-81d7-a0cdde1f5e8a&pf_rd_i=2238192011">
                        Send Amazon Gift Card
                    </NewTabLink> Use recipient: "liquidmonkey@gmail.com"
                </Item>
                <Item title="Amazon Wishlist">
                    <NewTabLink
                        className="btn btn-default"
                        href="http://www.amazon.com/registry/wishlist/3NRDPJN4K2FS2/ref=cm_sw_r_tw_ws_m-SDyb5YYXVND">
                        Buy something from my wishlist
                    </NewTabLink>
                </Item>
                <Item title="Bitcoin">
                    <NewTabLink
                        className="btn btn-default"
                        href="https://www.coinbase.com/nuclearspike">Send Bitcoin</NewTabLink> Send
                    using coinbase wallet or direct to my bitcoin address. If you send via my wallet address, it will be
                    anonymous.
                </Item>
                <Item title="Ethereum">
                    If you have ETH (Ether), then you likely know how to send it. This method is fully anonymous. Here's
                    the address: <b>0x0d0d9bdfd5a289e30deef2d079edc31c2aa2f931</b>
                </Item>

            </Grid>
        );
    }
}


export default Donate;