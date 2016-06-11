"use strict";

/**
 * This file is loaded in the worker processes and must pass off all queries to the
 * master since they don't keep their own copies of the loans/partners.
 */

var graphql = require('graphql');
var Hub = require('cluster-hub')
var hub = new Hub()
require('datejs');

var req = require('./react/src/scripts/api/kivajs/req')

/**
 * "limit_to": {
      "enabled": true,
      "count": 1,
      "limit_by": "Partner"
    }
 */

/**
 * allow formatting of dates
 *
 * @param description
 * @param selector if the field name differs from the name used in the graph query, define it.
 * @returns {{type: *, description: *, args: {format: {type: *, description: string}}, resolve: resolve}}
 */
const dateStringType = (description, selector) => {
    return {
        type: graphql.GraphQLString,
        description,
        args: {
            format: {
                type: graphql.GraphQLString,
                description: "Optional: Any DateJS format options. ex: MMM yyyy, MM-dd-yyyy. Only use when you want the time to be localized to the server's time. Otherwise, you should parse the default date in the browser/device and localize there to have it relevant."
            }
        },
        resolve: function (_, args, a, fieldSchema) {
            const fieldVal =  selector ? selector(_) : _[fieldSchema.fieldName]
            if (!fieldVal) return null
            if (args.format) {
                let d = typeof fieldVal === 'string' ? new Date(fieldVal) : fieldVal
                try {
                    return d.toString(args.format)
                } catch (e) {
                    return e.message
                }
            } else {
                return typeof fieldVal === 'string' ? fieldVal : fieldVal.toISOString()
            }
        }
    }
}

const criteriaLoanType = new graphql.GraphQLInputObjectType({
    name: "LoanCriteria",
    description: "Criteria related to the loan itself",
    fields: {
        "name": { type: graphql.GraphQLString },
        "use": { type: graphql.GraphQLString },
        "country_code": { type: graphql.GraphQLString },
        "country_code_all_any_none": { type: graphql.GraphQLString },
        "sector": { type: graphql.GraphQLString },
        "sector_all_any_none": { type: graphql.GraphQLString },
        "activity": { type: graphql.GraphQLString },
        "activity_all_any_none": { type: graphql.GraphQLString },
        "themes": { type: graphql.GraphQLString },
        "themes_all_any_none": { type: graphql.GraphQLString },
        "tags": { type: graphql.GraphQLString },
        "tags_all_any_none": { type: graphql.GraphQLString },
        "repayment_interval": {
            type: graphql.GraphQLString,
            description: "Options: Monthly, At end of term, Irregularly"
        },
        "currency_exchange_loss_liability": { type: graphql.GraphQLString },
        "bonus_credit_eligibility": { type: graphql.GraphQLString },
        "sort": {
            type: graphql.GraphQLString,
            description: "Options: half_back, popularity, newest, expiring, still_needed or blank for default (repaid first)"
        },
        "repaid_in_min": { type: graphql.GraphQLFloat },
        "repaid_in_max": { type: graphql.GraphQLFloat },
        "borrower_count_min": { type: graphql.GraphQLInt },
        "borrower_count_max": { type: graphql.GraphQLInt },
        "percent_female_min": { type: graphql.GraphQLFloat },
        "percent_female_max": { type: graphql.GraphQLFloat },
        "age_min": { type: graphql.GraphQLInt },
        "age_max": { type: graphql.GraphQLInt },
        "loan_amount_min": { type: graphql.GraphQLInt },
        "loan_amount_max": { type: graphql.GraphQLInt },
        "still_needed_min": { type: graphql.GraphQLInt },
        "still_needed_max": { type: graphql.GraphQLInt },
        "percent_funded_min": { type: graphql.GraphQLFloat },
        "percent_funded_max": { type: graphql.GraphQLFloat },
        "dollars_per_hour_min": { type: graphql.GraphQLFloat },
        "dollars_per_hour_max": { type: graphql.GraphQLFloat },
        "expiring_in_days_min": { type: graphql.GraphQLFloat },
        "expiring_in_days_max": { type: graphql.GraphQLFloat },
        "disbursal_in_days_min": { type: graphql.GraphQLFloat },
        "disbursal_in_days_max": { type: graphql.GraphQLFloat },
    }
})

const criteriaPartnerType = new graphql.GraphQLInputObjectType({
    name: "PartnerCriteria",
    description: "Criteria related to the partner",
    fields: {
        //"status": { type: graphql.GraphQLString },
        "region": { type: graphql.GraphQLString },
        "region_all_any_none":{ type: graphql.GraphQLString },
        "partners": { type: graphql.GraphQLString, description: "Comma-separated list of partner ids" },
        "partners_all_any_none": { type: graphql.GraphQLString },
        "social_performance": { type: graphql.GraphQLString, description:"Comma-separated list of SP ids" },
        "social_performance_all_any_none": { type: graphql.GraphQLString },
        "charges_fees_and_interest": { type: graphql.GraphQLString, description: "boolean string" },
        "partner_risk_rating_min": { type: graphql.GraphQLFloat },
        "partner_risk_rating_max": { type: graphql.GraphQLFloat },
        "partner_arrears_min": { type: graphql.GraphQLFloat },
        "partner_arrears_max": { type: graphql.GraphQLFloat },
        "loans_at_risk_rate_min": { type: graphql.GraphQLFloat },
        "loans_at_risk_rate_max": { type: graphql.GraphQLFloat },
        "partner_default_min": { type: graphql.GraphQLFloat },
        "partner_default_max": { type: graphql.GraphQLFloat },
        "portfolio_yield_min": { type: graphql.GraphQLFloat },
        "portfolio_yield_max": { type: graphql.GraphQLFloat },
        "profit_min": { type: graphql.GraphQLFloat },
        "profit_max": { type: graphql.GraphQLFloat },
        "currency_exchange_loss_rate_min": { type: graphql.GraphQLFloat },
        "currency_exchange_loss_rate_max": { type: graphql.GraphQLFloat },
        "average_loan_size_percent_per_capita_income_min": { type: graphql.GraphQLFloat },
        "average_loan_size_percent_per_capita_income_max": { type: graphql.GraphQLFloat },
        "years_on_kiva_min": { type: graphql.GraphQLFloat },
        "years_on_kiva_max": { type: graphql.GraphQLFloat },
        "loans_posted_min": { type: graphql.GraphQLInt },
        "loans_posted_max": { type: graphql.GraphQLInt },
        "secular_rating_min": { type: graphql.GraphQLInt },
        "secular_rating_max": { type: graphql.GraphQLInt },
        "social_rating_min": { type: graphql.GraphQLInt },
        "social_rating_max": { type: graphql.GraphQLInt },
    }
})

const criteriaType = new graphql.GraphQLInputObjectType({
    name: 'Criteria',
    description: 'Construct a JSON object of the critiera. "loans(criteria:{loan:{repaid_in_max:6}}) ...',
    fields: {
        loan: { type: criteriaLoanType },
        partner: { type: criteriaPartnerType }
    }
});

const locationType = new graphql.GraphQLObjectType({
    name: "Location",
    fields: {
        country_code: { type: graphql.GraphQLString },
        country: { type: graphql.GraphQLString },
    }
})

const scheduledPaymentsType = new graphql.GraphQLObjectType({
    name: "ScheduledPayment",
    fields: {
        "due_date": dateStringType("Date the repayment is due"),
        "amount": { type: graphql.GraphQLFloat },
    }
})

const klScheduledPaymentsType = new graphql.GraphQLObjectType({
    name: "KLScheduledPayment",
    fields: {
        "date": dateStringType("Date the repayment is due"),
        "display": { type: graphql.GraphQLString },
        "amount": { type: graphql.GraphQLFloat },
        "percent": { type: graphql.GraphQLFloat }
    }
})

const lossLiabilityType =  new graphql.GraphQLObjectType({
    name: "LossLiability",
    fields: {
        "nonpayment": { type: graphql.GraphQLString },
        "currency_exchange": { type: graphql.GraphQLString },
        "currency_exchange_coverage_rate":{ type: graphql.GraphQLFloat},
    }
})

const termsType = new graphql.GraphQLObjectType({
    name: "Terms",
    fields: {
        "local_payments": {
            type: new graphql.GraphQLList(graphql.GraphQLString),
            description:"This field has been deprecated for borrower privacy",
            deprecationReason: "Due to increased borrower privacy, this field is no longer available and will always return an empty array.",
            resolve:()=>[]
        },
        "disbursal_date": dateStringType("Date the borrower will receive/received the loan"),
        "repayment_interval": { type: graphql.GraphQLString },
        "repayment_term": { type: graphql.GraphQLInt },
        "loss_liability": { type: lossLiabilityType },
        "scheduled_payments":  { type: new graphql.GraphQLList(scheduledPaymentsType) },
    }
})

const borrowerType = new graphql.GraphQLObjectType({
    name: "Borrower",
    fields: {
        first_name: { type: graphql.GraphQLString },
        gender: { type: graphql.GraphQLString },
        pictured: { type: graphql.GraphQLBoolean }
    }
})

const descriptionTextType = new graphql.GraphQLObjectType({
    name: "DescriptionText",
    fields: {
        en: { type: graphql.GraphQLString }
    }
})

const descriptionType = new graphql.GraphQLObjectType({
    name: "Descriptions",
    fields: {
        texts: { type: descriptionTextType },
    }
})

/**
 *
  "image": {
    "id": 2217179,
    "template_id": 1
    },
 *
 * @type {graphql.GraphQLObjectType}
 */

const imageType = new graphql.GraphQLObjectType({
    name: "Image",
    description: "Images for Loans, Partners and Lenders",
    fields: {
        id: { type: graphql.GraphQLInt },
        template_id: { type: graphql.GraphQLInt },
        url: {
            type: graphql.GraphQLString,
            args: {
                size: {
                    type: graphql.GraphQLString,
                    required: true,
                    description: "ex: s800, w800"
                }
            },
            resolve: (_, args) => `https://www.kiva.org/img/${args.size}/${_.id}.jpg`
        }
    }
})

const loanType = new graphql.GraphQLObjectType({
    name: 'Loan',
    fields: ()=>({
        id: {type: graphql.GraphQLInt},
        name: {type: graphql.GraphQLString},
        status: {type: graphql.GraphQLString},
        funded_amount: {type: graphql.GraphQLInt},
        basket_amount: {type: graphql.GraphQLInt},
        loan_amount: {type: graphql.GraphQLInt},
        lender_count: {type: graphql.GraphQLInt},
        partner_id: {type: graphql.GraphQLInt},
        activity: {type: graphql.GraphQLString},
        sector: {type: graphql.GraphQLString},
        posted_date: dateStringType("Date and time the loan began fundraising"),
        planned_expiration_date: dateStringType("Date and time the loan will expire if not funded"),
        use: {type: graphql.GraphQLString},
        bonus_credit_eligibility: {type: graphql.GraphQLBoolean},
        location: {type: locationType},
        //borrower_count: { type: graphql.GraphQLInt },
        borrowers: {type: new graphql.GraphQLList(borrowerType)},
        themes: {type: new graphql.GraphQLList(graphql.GraphQLString)},
        terms: {type: termsType},
        description: {type: descriptionType},
        image : {type: imageType},
        kl_description: {
            type: graphql.GraphQLString,
            args: {language: {type: graphql.GraphQLString}},
            resolve: (_, args) => {
                //KL currently removes all non-English descriptions... so,
                var lang = args.language || 'en'
                return _.description.texts[lang]
            }
        },
        tags: {
            type: new graphql.GraphQLList(graphql.GraphQLString),
            resolve: _ => _.kls_tags
        },
        age: {
            type: graphql.GraphQLInt,
            description: "The first age found in the description. Searches for patterns like '22 years old' or 'aged 40 years' which could potentially be the age of the borrower's child or parents.",
            resolve: _ => _.kls_age
        },
        half_back: dateStringType('The date half of the amount is back', _ => _.kls_half_back),
        half_back_actual: {
            type: graphql.GraphQLFloat,
            description: "The actual percent back on the day when 50% is back",
            resolve: _ => _.kls_half_back_actual
        },
        three_fourths_back: dateStringType('The date 75% of the amount is back', _ => _.kls_75_back),
        three_fourths_back_actual: {
            type: graphql.GraphQLFloat,
            description: "The actual percent back on the day when 75% is back",
            resolve: _ => _.kls_75_back_actual
        },
        final_repayment: dateStringType('The date of the final repayment', _ => _.kls_final_repayment),
        repayments: {
            type: new graphql.GraphQLList(klScheduledPaymentsType),
            description: "KivaLens-specific way of handling repayments. Allows for filled-in 0 amounts.",
            args: {
                show_zero_amounts: {type: graphql.GraphQLBoolean}
            },
            resolve: (_, args) => {
                return args.show_zero_amounts ? _.kl_repayments : _.kl_repayments.where(r => r.amount)
            }
        },
        partner: {
            type: partnerType,
            resolve: (_, args) => {
                return new Promise((resolve, reject) => {
                    hub.requestMaster('get-partner-by-id', _.partner_id, result => {
                        resolve(result)
                    })
                })
            }
        },
        similar: {
            type: new graphql.GraphQLList(loanType),
            description: "Other loans that are similiar to this one (country, sector, etc)",
            resolve: (_,args) => {
                return new Promise((resolve, reject) => {
                    req.kiva.api.similarTo(_.id)
                        .done(loans => {
                            hub.requestMaster('get-loans-by-ids', loans.where(l=>l.id != _.id).select(l=>l.id), result => {
                                resolve(result)
                            })
                        })
                        .fail(()=>resolve(null))
                })
            }
        }
    })
});

const partnerType = new graphql.GraphQLObjectType({
    name: "Partner",
    fields: {
        "id": { type: graphql.GraphQLInt },
        "name": { type: graphql.GraphQLString },
        "status": { type: graphql.GraphQLString },
        "rating": { type: graphql.GraphQLString },
        "start_date": dateStringType("When the partner joined Kiva"),
        "delinquency_rate": { type: graphql.GraphQLFloat },
        "default_rate": { type: graphql.GraphQLFloat },
        "total_amount_raised": { type: graphql.GraphQLInt },
        "loans_posted": { type: graphql.GraphQLInt },
        "profitability": { type: graphql.GraphQLFloat },
        "delinquency_rate_note": { type: graphql.GraphQLString },
        "default_rate_note": { type: graphql.GraphQLString },
        "portfolio_yield_note": { type: graphql.GraphQLString },
        "charges_fees_and_interest": { type: graphql.GraphQLBoolean },
        "average_loan_size_percent_per_capita_income": { type: graphql.GraphQLFloat },
        "loans_at_risk_rate": { type: graphql.GraphQLFloat },
        "currency_exchange_loss_rate": { type: graphql.GraphQLFloat },
        "url": { type: graphql.GraphQLString },
        image : {type: imageType},
    }
});

const lenderType = new graphql.GraphQLObjectType({
    name: "Lender",
    fields: {
        "lender_id": { type: graphql.GraphQLString },
        "name": { type: graphql.GraphQLString },
        "whereabouts": { type: graphql.GraphQLString },
        "country_code": { type: graphql.GraphQLString },
        "member_since": dateStringType("When the lender joined Kiva"),
        "personal_url": { type: graphql.GraphQLString },
        "occupation": { type: graphql.GraphQLString },
        "loan_because": { type: graphql.GraphQLString },
        "occupational_info": { type: graphql.GraphQLString },
        "loan_count": { type: graphql.GraphQLInt },
        "invitee_count": { type: graphql.GraphQLInt },
        image : {type: imageType},
    }
})

const onNowUsersType = new graphql.GraphQLObjectType({
    name: "OnNowUser",
    fields: {
        "lender_id": {
            type: graphql.GraphQLString,
            resolve: _ => _.lender_id == "unknown" ? null : _.lender_id
        },
        "lender": {
            type: lenderType,
            resolve: function(_, args){
                if (_.lender_id == "unknown") return null
                return new Promise((resolve, reject) => {
                    req.kiva.api.lender(_.lender_id)
                        .done(resolve)
                        .fail(reject)
                })
            }
        },
        "install": { type: graphql.GraphQLString },
        "uptime": { type: graphql.GraphQLInt }
    }
})

const statsType = new graphql.GraphQLObjectType({
    name: "Stats",
    fields: {
        on: { 
            type: new graphql.GraphQLList(onNowUsersType),
            description: "Who is on right now",
            resolve: () => checkRCForHeartbeats('heartbeat_*')
        },
        on24: {
            type: new graphql.GraphQLList(onNowUsersType),
            description: "Who was on in the past 24 hours",
            resolve: () => checkRCForHeartbeats('on_past_24h_heartbeat_*')
        }
    }
})

function checkRCForHeartbeats(key) {
    return new Promise(resolve => {
        const rc = process.env.REDISCLOUD_URL ? require('redis').createClient(process.env.REDISCLOUD_URL) : null
        if (!rc) {
            resolve([])
            console.log("no rc. export the REDISCLOUD_URL")
            return
        }
        rc.keys(key, function (err, keys) {
            if (keys && keys.length) {
                //console.log(err, keys)
                rc.mget(keys, function (err, data) {
                    //console.log(err, data)
                    if (!err && data) {
                        try {
                            resolve(data.map(str => {
                                let online = JSON.parse(str)
                                online.lender_id = online.lender
                                delete online.lender
                                return online
                            }))
                        } catch (e) {
                            console.log("STATS ERROR 1: ", e.message)
                        }
                    }
                })
            }
        })
    })
}


const schema = new graphql.GraphQLSchema({
    query: new graphql.GraphQLObjectType({
        name: 'Query',
        fields: {
            partner: {
                type: partnerType,
                args: {
                    id: {type: graphql.GraphQLInt}
                },
                resolve: function(_,args){
                    return new Promise((resolve, reject) => {
                        if (args.id) {
                            hub.requestMaster('get-partner-by-id', args.id, result => {
                                resolve(result)
                            })
                        }
                    })
                }
            },
            partners: {
                type: new graphql.GraphQLList(partnerType),
                args: {
                    criteria: {type: criteriaPartnerType},
                    ids: {type: new graphql.GraphQLList(graphql.GraphQLInt)}
                },
                resolve: function(_, args) {
                    return new Promise((resolve, reject) => {
                        if (args.ids && Array.isArray(args.ids)) {
                            hub.requestMaster('get-partners-by-ids', args.ids, result => {
                                resolve(result)
                            })
                        } else {
                            let crit = {partner: {}, portfolio: {}}
                            if (args.criteria) {
                                crit.partner = args.criteria
                            }

                            hub.requestMaster('filter-partners', crit, result => {
                                resolve(result)
                            })
                        }
                    })
                }
            },
            loan: {
                type: loanType,
                args: {
                    id: {type: graphql.GraphQLInt}
                },
                resolve: function (_, args) {
                    return new Promise((resolve, reject) => {
                        hub.requestMaster('loan-id', args.id, (err, result) => {
                            resolve(result)
                        })
                    })
                }
            },
            loans: {
                type: new graphql.GraphQLList(loanType),
                args: {
                    criteria: {type: criteriaType},
                    ids: {type: new graphql.GraphQLList(graphql.GraphQLInt)},
                    sectors: {
                        isDeprecated: true,
                        deprecationReason: "Please use the criteria argument instead",
                        type: graphql.GraphQLString
                    }
                },
                resolve: function(_, args) {
                    return new Promise((resolve, reject) => {
                        if (args.ids) {
                            hub.requestMaster('get-loans-by-ids', args.ids, result => {
                                resolve(result)
                            })
                        } else {
                            let crit = {loan: {}}
                            if (args.sectors) {
                                crit = {loan: {sector: args.sectors}}
                            }
                            if (args.criteria) {
                                crit = Object.assign({}, crit, args.criteria)
                            }
                            crit.loan.limit_results = 500
                            hub.requestMaster('filter-loans', crit, result => {
                                resolve(result)
                            })
                        }
                    })
                }
            },
            stats: {
                type: statsType,
                description: "Statistics",
                args: {
                    key: {type: graphql.GraphQLInt}
                },
                resolve: (_, args)=>{
                    if (args.key == process.env.RESET_I) {
                        return {} //this is weird. but this switches this field active.
                    }
                }
            }
        }
    })
});

module.exports = schema