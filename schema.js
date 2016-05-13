var graphql = require('graphql');

var Hub = require('cluster-hub')
var hub = new Hub()

var graphql = require('graphql');

const locationType = new graphql.GraphQLObjectType({
    name: "Location",
    fields: {
        country_code: { type: graphql.GraphQLString },
        country: { type: graphql.GraphQLString },
    }
})

const scheduledPaymentsType =  new graphql.GraphQLObjectType({
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

var loanType = new graphql.GraphQLObjectType({
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
        terms: { type: termsType }
    })
});

var schema = new graphql.GraphQLSchema({
    query: new graphql.GraphQLObjectType({
        name: 'Query',
        fields: {
            loan: {
                type: loanType,
                // `args` describes the arguments that the `loan` query accepts
                args: {
                    id: {type: graphql.GraphQLInt}
                },
                // The resolve function describes how to "resolve" or fulfill
                // the incoming query.
                // In this case we use the `id` argument from above as a key
                // to get the User from `data`
                resolve: function (_, args) {
                    return new Promise((resolve, reject) => {
                        hub.requestMaster('loan-id', args.id, (err, result) => {
                            resolve(result)
                        })
                    })
                }
            }
        }
    })
});

module.exports = schema