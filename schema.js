"use strict";
var graphql = require('graphql');
var Hub = require('cluster-hub')
var hub = new Hub()

var req = require('./react/src/scripts/api/kivajs/req')

/**
 * "limit_to": {
      "enabled": true,
      "count": 1,
      "limit_by": "Partner"
    }
 */

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
        "due_date": { type: graphql.GraphQLString },
        "amount": { type: graphql.GraphQLFloat },
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
        "disbursal_date": { type: graphql.GraphQLString },
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
        pictured: { type: graphql.GraphQLBoolean },
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
        posted_date: {type: graphql.GraphQLString},
        planned_expiration_date: {type: graphql.GraphQLString},
        use: {type: graphql.GraphQLString},
        bonus_credit_eligibility: {type: graphql.GraphQLBoolean},
        location: {type: locationType},
        //borrower_count: { type: graphql.GraphQLInt },
        borrowers: {type: new graphql.GraphQLList(borrowerType)},
        themes: {type: new graphql.GraphQLList(graphql.GraphQLString)},
        terms: {type: termsType},
        tags: {
            type: new graphql.GraphQLList(graphql.GraphQLString),
            resolve: function (_, args) {
                return _.kls_tags
            }
        },
        age: {
            type: graphql.GraphQLInt,
            resolve: function (_, args) {
                return _.kls_age
            }
        },
        final_repayment: {
            type: graphql.GraphQLString,
            description: "The date of the final repayment",
            resolve: function (_, args) {
                return _.kl_repayments[_.kl_repayments.length - 1].date
            }
        },
        partner: {
            type: partnerType,
            resolve: function (_, args) {
                return new Promise((resolve, reject) => {
                    hub.requestMaster('get-partner-by-id', _.partner_id, result => {
                        resolve(result)
                    })
                })
            }
        },
        similar: {
            type: new graphql.GraphQLList(loanType),
            resolve: function(_,args){
                return new Promise((resolve, reject) => {
                    req.kiva.api.similarTo(_.id)
                        .done(loans => {
                            hub.requestMaster('get-loans-by-ids', loans.select(l=>l.id), result => {
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
        "start_date": { type: graphql.GraphQLString },
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
    }
});

const schema = new graphql.GraphQLSchema({
    query: new graphql.GraphQLObjectType({
        name: 'Query',
        fields: {
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
                        if (args.ids) {
                            hub.requestMaster('get-partners-by-ids', args.ids, result => {
                                resolve(result)
                            })
                        } else {
                            let crit = {partner:{}, portfolio: {}}
                            crit.partner = args.criteria
                            hub.requestMaster('filter-partners', crit, result => {
                                resolve(result)
                            })
                        }
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
                    },
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
            }
        }
    })
});

module.exports = schema