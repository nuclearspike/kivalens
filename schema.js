"use strict";
var graphql = require('graphql');
var Hub = require('cluster-hub')
var hub = new Hub()

const criteriaLoanType = new graphql.GraphQLInputObjectType({
    name: "CriteriaLoanType",
    description: "Criteria related to the loan itself",
    fields: {
        "name": { type: graphql.GraphQLString },
        "use": { type: graphql.GraphQLString },
        "country_code": { type: graphql.GraphQLString },
        "sector": { type: graphql.GraphQLString },
        "activity": { type: graphql.GraphQLString },
        "themes": { type: graphql.GraphQLString },
        "tags": { type: graphql.GraphQLString },
        "repayment_interval": { type: graphql.GraphQLString },
        "currency_exchange_loss_liability": { type: graphql.GraphQLString },
        "bonus_credit_eligibility": { type: graphql.GraphQLString },
        "sort": {
            type: graphql.GraphQLString,
            description: "Options: half_back, popularity, newest, expiring, still_needed"
        },
        "repaid_in_min": { type: graphql.GraphQLFloat },
        "repaid_in_max": { type: graphql.GraphQLFloat },
        "borrower_count_min": { type: graphql.GraphQLFloat },
        "borrower_count_max": { type: graphql.GraphQLFloat },
        "percent_female_min": { type: graphql.GraphQLFloat },
        "percent_female_max": { type: graphql.GraphQLFloat },
        "age_min": { type: graphql.GraphQLFloat },
        "age_max": { type: graphql.GraphQLFloat },
        "loan_amount_min": { type: graphql.GraphQLFloat },
        "loan_amount_max": { type: graphql.GraphQLFloat },
        "still_needed_min": { type: graphql.GraphQLFloat },
        "still_needed_max": { type: graphql.GraphQLFloat },
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
    name: "CriteriaPartnerType",
    description: "Criteria related to the partner",
    fields: {
        "name": { type: graphql.GraphQLString },
    }
})

const criteriaType = new graphql.GraphQLInputObjectType({
    name: 'CriteriaType',
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
        id: { type: graphql.GraphQLInt },
        name: { type: graphql.GraphQLString },
        status: { type: graphql.GraphQLString },
        funded_amount: { type: graphql.GraphQLInt },
        basket_amount: { type: graphql.GraphQLInt },
        loan_amount: { type: graphql.GraphQLInt },
        lender_count: { type: graphql.GraphQLInt },
        partner_id: { type: graphql.GraphQLInt },
        activity: { type: graphql.GraphQLString },
        sector: { type: graphql.GraphQLString },
        posted_date: { type: graphql.GraphQLString },
        planned_expiration_date: { type: graphql.GraphQLString },
        use: { type: graphql.GraphQLString },
        bonus_credit_eligibility: { type: graphql.GraphQLBoolean },
        location: { type: locationType },
        borrowers: { type: new graphql.GraphQLList(borrowerType) },
        themes: { type: new graphql.GraphQLList(graphql.GraphQLString) },
        terms: { type: termsType },
        final_repayment: {
            type: graphql.GraphQLString,
            description: "The date of the final repayment",
            resolve: function(_, args){
                return _.kl_repayments[_.kl_repayments.length - 1].date
            }
        },
    })
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
            loans: {
                type: new graphql.GraphQLList(loanType),
                args: {
                    sectors: {
                        isDeprecated: true,
                        deprecationReason: "Please use the criteria option instead",
                        type: graphql.GraphQLString
                    },
                    criteria: {type: criteriaType},
                },
                resolve: function(_, args) {
                    return new Promise((resolve, reject) => {
                        let crit = {}
                        if (args.sectors) {
                            crit = { loan : { sector: args.sectors } }
                        }
                        if (args.criteria) {
                            crit = args.criteria
                        }

                        hub.requestMaster('filter-loans', crit, result => {
                            resolve(result)
                        })
                    })
                }
            }
        }
    })
});

module.exports = schema