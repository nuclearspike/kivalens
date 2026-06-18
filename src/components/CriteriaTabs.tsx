import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Row, Col, Tab, Tabs, Form, Dropdown, Card, Alert, OverlayTrigger, Popover } from '../ui'
import Select from './KLSelect'
import type { MultiValue, SingleValue } from 'react-select'
import Slider from 'rc-slider'
// rc-slider base CSS is imported globally in main.tsx
import numeral from 'numeral'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'
import { useCriteriaStore, useLoanStore } from '../stores'
import { showAlert } from '../lib/dialog'
import type { Criteria, BalancerConfig, KivaLoan, Partner } from '../types'
import type { BalancerResult } from '../stores/criteriaStore'
import { getKivaLoans } from '../api/kiva'
import { lsj } from '../lib/localStorage'
import { humanize } from '../lib/utils'

// ---------------------------------------------------------------------------
// Custom hook: useDebouncedEffect
// ---------------------------------------------------------------------------

function useDebouncedEffect(fn: () => void, deps: unknown[], delay: number) {
  const fnRef = useRef(fn)
  fnRef.current = fn
  useEffect(() => {
    const id = setTimeout(() => fnRef.current(), delay)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, delay])
}

// ---------------------------------------------------------------------------
// Option types for react-select
// ---------------------------------------------------------------------------

interface SelectOption {
  value: string
  label: string
}

interface HelperChartDatum {
  name: string
  count: number
}

interface HelperChart {
  title: string
  data: HelperChartDatum[]
}

interface HelperChartTarget {
  group: 'loan' | 'partner'
  key: string
  canAll?: boolean
}

// ---------------------------------------------------------------------------
// allOptions - static dropdown/slider configuration data
// ---------------------------------------------------------------------------

const COUNTRY_OPTIONS: SelectOption[] = [
  { value: 'AF', label: 'Afghanistan' }, { value: 'AL', label: 'Albania' }, { value: 'AM', label: 'Armenia' },
  { value: 'AZ', label: 'Azerbaijan' }, { value: 'BJ', label: 'Benin' }, { value: 'BO', label: 'Bolivia' },
  { value: 'BA', label: 'Bosnia and Herzegovina' }, { value: 'BR', label: 'Brazil' },
  { value: 'BF', label: 'Burkina Faso' }, { value: 'BI', label: 'Burundi' }, { value: 'KH', label: 'Cambodia' },
  { value: 'CM', label: 'Cameroon' }, { value: 'TD', label: 'Chad' }, { value: 'CL', label: 'Chile' },
  { value: 'CN', label: 'China' }, { value: 'CO', label: 'Colombia' }, { value: 'CG', label: 'Congo' },
  { value: 'CD', label: 'Congo (Dem. Rep.)' }, { value: 'CR', label: 'Costa Rica' },
  { value: 'CI', label: "Cote D'Ivoire" }, { value: 'DO', label: 'Dominican Republic' },
  { value: 'EC', label: 'Ecuador' }, { value: 'EG', label: 'Egypt' }, { value: 'SV', label: 'El Salvador' },
  { value: 'GE', label: 'Georgia' }, { value: 'GH', label: 'Ghana' }, { value: 'GT', label: 'Guatemala' },
  { value: 'GN', label: 'Guinea' }, { value: 'HT', label: 'Haiti' }, { value: 'HN', label: 'Honduras' },
  { value: 'IN', label: 'India' }, { value: 'ID', label: 'Indonesia' }, { value: 'IQ', label: 'Iraq' },
  { value: 'IL', label: 'Israel' }, { value: 'JO', label: 'Jordan' }, { value: 'KE', label: 'Kenya' },
  { value: 'XK', label: 'Kosovo' }, { value: 'KG', label: 'Kyrgyzstan' }, { value: 'LA', label: 'Laos' },
  { value: 'LB', label: 'Lebanon' }, { value: 'LR', label: 'Liberia' }, { value: 'MG', label: 'Madagascar' },
  { value: 'MW', label: 'Malawi' }, { value: 'ML', label: 'Mali' }, { value: 'MX', label: 'Mexico' },
  { value: 'MD', label: 'Moldova' }, { value: 'MN', label: 'Mongolia' }, { value: 'MZ', label: 'Mozambique' },
  { value: 'MM', label: 'Myanmar (Burma)' }, { value: 'NA', label: 'Namibia' }, { value: 'NP', label: 'Nepal' },
  { value: 'NI', label: 'Nicaragua' }, { value: 'NE', label: 'Niger' }, { value: 'NG', label: 'Nigeria' },
  { value: 'PK', label: 'Pakistan' }, { value: 'PS', label: 'Palestine' }, { value: 'PA', label: 'Panama' },
  { value: 'PG', label: 'Papua New Guinea' }, { value: 'PY', label: 'Paraguay' }, { value: 'PE', label: 'Peru' },
  { value: 'PH', label: 'Philippines' }, { value: 'PR', label: 'Puerto Rico' }, { value: 'RW', label: 'Rwanda' },
  { value: 'WS', label: 'Samoa' }, { value: 'SN', label: 'Senegal' }, { value: 'SL', label: 'Sierra Leone' },
  { value: 'SB', label: 'Solomon Islands' }, { value: 'SO', label: 'Somalia' },
  { value: 'ZA', label: 'South Africa' }, { value: 'SS', label: 'South Sudan' },
  { value: 'LK', label: 'Sri Lanka' }, { value: 'SR', label: 'Suriname' }, { value: 'TJ', label: 'Tajikistan' },
  { value: 'TZ', label: 'Tanzania' }, { value: 'TH', label: 'Thailand' },
  { value: 'TL', label: 'Timor-Leste' }, { value: 'TG', label: 'Togo' }, { value: 'TO', label: 'Tonga' },
  { value: 'TR', label: 'Turkey' }, { value: 'UG', label: 'Uganda' }, { value: 'UA', label: 'Ukraine' },
  { value: 'US', label: 'United States' }, { value: 'VN', label: 'Vietnam' },
  { value: 'VU', label: 'Vanuatu' }, { value: 'YE', label: 'Yemen' }, { value: 'ZM', label: 'Zambia' },
  { value: 'ZW', label: 'Zimbabwe' },
]

const SECTOR_OPTIONS: SelectOption[] = [
  'Agriculture', 'Arts', 'Clean Energy', 'Clothing', 'Construction', 'Education',
  'Entertainment', 'Food', 'Health', 'Housing', 'Manufacturing', 'Personal Use', 'Retail',
  'Reuse & Recycle', 'Sanitation & Hygiene', 'Services', 'Transportation', 'Water',
  'Wholesale',
].map((s) => ({ value: s, label: s }))

// Kiva's full activity taxonomy (from the original app)
const ACTIVITY_OPTIONS: SelectOption[] = [
  'Agriculture', 'Air Conditioning', 'Animal Sales', 'Aquaculture', 'Arts', 'Auto Repair',
  'Bakery', 'Balut-Making', 'Barber Shop', 'Beauty Salon', 'Beverages', 'Bicycle Repair',
  'Bicycle Sales', 'Blacksmith', 'Bookbinding', 'Bookstore', 'Bricks', 'Butcher Shop', 'Cafe',
  'Call Center', 'Carpentry', 'Catering', 'Cattle', 'Cement', 'Cereals', 'Charcoal Sales',
  'Cheese Making', 'Child Care', 'Cleaning Services', 'Cloth & Dressmaking Supplies',
  'Clothing', 'Clothing Sales', 'Cobbler', 'Communications', 'Community Water Distribution',
  'Computer', 'Computers', 'Construction', 'Construction Supplies', 'Consumer Goods',
  'Cosmetics Sales', 'Crafts', 'Dairy', 'Day Care/Adult Care', 'Decorations Sales', 'Dental',
  'Education provider', 'Electrical Goods', 'Electrician', 'Electronics Repair',
  'Electronics Sales', 'Embroidery', 'Energy', 'Entertainment', 'Event Planning',
  'Farm Supplies', 'Farming', 'Film', 'Fish Selling', 'Fishing', 'Florist', 'Flowers', 'Food',
  'Food Market', 'Food Production/Sales', 'Food Stall', 'Fruits & Vegetables', 'Fuel/Firewood',
  'Funeral Expenses', 'Furniture Making', 'Games', 'General Store', 'Goods Distribution',
  'Grocery Store', 'Hardware', 'Health', 'Higher education costs', 'Home Appliances',
  'Home Energy', 'Home Products Sales', 'Hotel', 'Internet Cafe', 'Jewelry', 'Knitting',
  'Land Rental', 'Landscaping / Gardening', 'Landscaping/Gardening', 'Laundry',
  'Liquor Store / Off-License', 'Livestock', 'Machine Shop', 'Machinery Rental',
  'Manufacturing', 'Medical Clinic', 'Metal Shop', 'Milk Sales', 'Mobile Phones',
  'Mobile Transactions', 'Motorcycle Repair', 'Motorcycle Transport', 'Movie Tapes & DVDs',
  'Music Discs & Tapes', 'Musical Instruments', 'Musical Performance', 'Natural Medicines',
  'Office Supplies', 'Other', 'Paper Sales', 'Party Supplies', 'Patchwork', 'Perfumes',
  'Personal Expenses', 'Personal Housing Expenses', 'Personal Medical Expenses',
  'Personal Products Sales', 'Personal Purchases', 'Pharmacy', 'Phone Accessories',
  'Phone Repair', 'Phone Use Sales', 'Photography', 'Pigs', 'Plastics Sales', 'Poultry',
  'Primary/secondary school costs', 'Printing', 'Property', 'Pub', 'Quarrying',
  'Recycled Materials', 'Recycling', 'Religious Articles', 'Renewable Energy Products',
  'Repair/Mechanic', 'Restaurant', 'Restaurant/Caterer', 'Retail', 'Rickshaw',
  'Secretarial Services', 'Services', 'Sewing', 'Shoe Sales', 'Social Enterprise',
  'Soft Drinks', 'Solar Home Systems', 'Souvenir Sales', 'Spare Parts', 'Sporting Good Sales',
  'Tailoring', 'Taxi', 'Textiles', 'Timber Sales', 'Toilets & Sanitation Systems', 'Tourism',
  'Transportation', 'Traveling Sales', 'Upholstery', 'Used Clothing', 'Used Shoes',
  'Utilities', 'Vehicle', 'Vehicle Repairs', 'Veterinary Sales', 'Waste Management',
  'Water Distribution', 'Water Pumps & Irrigation', 'Weaving', 'Wedding Expenses',
  'Well digging', 'Wholesale',
].map((s) => ({ value: s, label: s }))

const TAG_OPTIONS: SelectOption[] = [
  { value: 'user_favorite', label: 'User Favorite' },
  { value: 'volunteer_like', label: 'Volunteer Like' },
  { value: 'volunteer_pick', label: 'Volunteer Pick' },
  { value: '#Animals', label: '#Animals' },
  { value: '#BizDurableAsset', label: '#BizDurableAsset' },
  { value: '#Eco-friendly', label: '#Eco-friendly' },
  { value: '#Elderly', label: '#Elderly' },
  { value: '#Fabrics', label: '#Fabrics' },
  { value: '#FemaleEducation', label: '#FemaleEducation' },
  { value: '#FirstLoan', label: '#FirstLoan' },
  { value: '#HealthandSanitation', label: '#HealthAndSanitation' },
  { value: '#JobCreator', label: '#JobCreator' },
  { value: '#Orphan', label: '#Orphan' },
  { value: '#Parent', label: '#Parent' },
  { value: '#Refugee', label: '#Refugee' },
  { value: '#RepairRenewReplace', label: '#RepairRenewReplace' },
  { value: '#RepeatBorrower', label: '#RepeatBorrower' },
  { value: '#Schooling', label: '#Schooling' },
  { value: '#Single', label: '#Single' },
  { value: '#SingleParent', label: '#SingleParent' },
  { value: '#SupportingFamily', label: '#SupportingFamily' },
  { value: '#SustainableAg', label: '#SustainableAg' },
  { value: '#Technology', label: '#Technology' },
  { value: '#Trees', label: '#Trees' },
  { value: '#Vegan', label: '#Vegan' },
  { value: '#Widowed', label: '#Widowed' },
  { value: '#WomanOwnedBiz', label: '#WomanOwnedBiz' },
  { value: '#BIPOC-ownedBusiness', label: '#BIPOC-ownedBusiness' },
  { value: '#COVID-19', label: '#COVID-19' },
  { value: '#CommunityImpact', label: '#CommunityImpact' },
  { value: '#InspiringStory', label: '#InspiringStory' },
  { value: '#Latinx/Hispanic-OwnedBusiness', label: '#Latinx/Hispanic-OwnedBusiness' },
  { value: '#NewBusiness', label: '#NewBusiness' },
  { value: '#PowerfulStory', label: '#PowerfulStory' },
  { value: '#StandoutBackstory', label: '#StandoutBackstory' },
  { value: '#TangibleProducts', label: '#TangibleProducts' },
  { value: '#USBlack-OwnedBusiness', label: '#USBlack-OwnedBusiness' },
  { value: '#USEtsy', label: '#USEtsy' },
  { value: '#USPGE', label: '#USPGE' },
  { value: '#USimmigrant', label: '#USimmigrant' },
  { value: '#Unique', label: '#Unique' },
  { value: '#Woman-OwnedBusiness', label: '#Woman-OwnedBusiness' },
  { value: 'BNY', label: 'BNY' },
  { value: 'USRefugee', label: 'USRefugee' },
]

const THEME_OPTIONS: SelectOption[] = [
  'Arab Youth', 'Clean Energy', 'Conflict Zones', 'Crop Insurance', 'Disaster recovery',
  'Earth Day Campaign', 'Fair Trade', 'Green', 'Growing Businesses', 'Health',
  'Higher Education', 'Innovative Loans', 'International COVID-19 support', 'Islamic Finance',
  'Job Creation', 'Mobile Technology', 'Refugees/Displaced', 'Rural Exclusion', 'SME',
  'Social Enterprise', 'Solar', 'Start-Up', 'Underfunded Areas', 'Vulnerable Groups',
  'Water and Sanitation', 'Youth',
].map((t) => ({ value: t, label: t }))

const REPAYMENT_INTERVAL_OPTIONS: SelectOption[] = [
  { value: 'Monthly', label: 'Monthly' },
  { value: 'Irregularly', label: 'Irregularly' },
  { value: 'At end of term', label: 'At end of term' },
]

const CURRENCY_LOSS_OPTIONS: SelectOption[] = [
  { value: 'shared', label: 'Shared Loss' },
  { value: 'none', label: 'No Currency Exchange Loss' },
  { value: 'partner', label: 'Partner covers' },
]

const BONUS_CREDIT_OPTIONS: SelectOption[] = [
  { value: '', label: 'Show All' },
  { value: 'true', label: 'Only loans eligible' },
  { value: 'false', label: 'Only loans NOT eligible' },
]

const SORT_OPTIONS: SelectOption[] = [
  { value: '', label: 'Final repayment date (default)' },
  { value: 'half_back', label: 'Date half is paid back, then 75%, then full' },
  { value: 'newest', label: 'Newest' },
  { value: 'expiring', label: 'Expiring' },
  { value: 'popularity', label: 'Popularity ($/hour)' },
  { value: 'still_needed', label: '$ Still Needed' },
]

// Partner selects
const DIRECT_OPTIONS: SelectOption[] = [
  { value: '', label: 'MFI Only (default)' },
  { value: 'direct', label: 'Direct Only' },
]

const REGION_OPTIONS: SelectOption[] = [
  { value: 'na', label: 'North America' }, { value: 'ca', label: 'Central America' },
  { value: 'sa', label: 'South America' }, { value: 'af', label: 'Africa' },
  { value: 'as', label: 'Asia' }, { value: 'me', label: 'Middle East' },
  { value: 'ee', label: 'Eastern Europe' }, { value: 'oc', label: 'Oceania' },
  { value: 'we', label: 'Western Europe' },
]

// Region code -> readable label (e.g. 'sa' -> 'South America') for chart axes.
const REGION_LABELS: Record<string, string> = Object.fromEntries(
  REGION_OPTIONS.map((o) => [o.value, o.label]),
)

const SOCIAL_PERFORMANCE_OPTIONS: SelectOption[] = [
  { value: '1', label: 'Anti-Poverty Focus' },
  { value: '3', label: 'Client Voice' },
  { value: '5', label: 'Entrepreneurial Support' },
  { value: '6', label: 'Facilitation of Savings' },
  { value: '4', label: 'Family and Community Empowerment' },
  { value: '7', label: 'Innovation' },
  { value: '2', label: 'Vulnerable Group Focus' },
]

const SOCIAL_PERFORMANCE_LABELS = Object.fromEntries(
  SOCIAL_PERFORMANCE_OPTIONS.map((option) => [String(option.value), option.label]),
)

const CHARGES_INTEREST_OPTIONS: SelectOption[] = [
  { value: '', label: 'Show All' },
  { value: 'true', label: 'Only partners that charge fees & interest' },
  { value: 'false', label: 'Only partners that do NOT charge fees & interest' },
]

const RELIGION_OPTIONS: SelectOption[] = [
  { value: 'Secular', label: 'Secular' }, { value: 'Christian', label: 'Christian' },
  { value: 'Christian Influence', label: 'Christian Influence' }, { value: 'Muslim', label: 'Muslim' },
  { value: 'Hindu', label: 'Hindu' }, { value: 'Jewish', label: 'Jewish' },
  { value: 'Buddhist', label: 'Buddhist' }, { value: 'Other', label: 'Other' },
  { value: 'Unknown', label: 'Unknown' },
]

const EXCLUDE_PORTFOLIO_OPTIONS: SelectOption[] = [
  { value: 'true', label: "Yes, Exclude Loans I've Made" },
  { value: 'false', label: "No, Include Loans I've Made" },
]

// Slider configs
interface SliderConfig {
  min: number
  max: number
  step?: number
  label: string
  helpText?: string
}

const LOAN_SLIDERS: Record<string, SliderConfig> = {
  repaid_in: { min: 2, max: 90, label: 'Repaid In (months)', helpText: 'The number of months between today and the final scheduled repayment.' },
  borrower_count: { min: 1, max: 20, label: 'Borrower Count', helpText: 'The number of borrowers included in the loan.' },
  percent_female: { min: 0, max: 100, label: 'Percent Female', helpText: 'What percentage of the borrowers are female.' },
  age: { min: 19, max: 100, label: 'Age Mentioned', helpText: 'Age found in the loan description. Set lower slider above min to exclude loans without detected ages.' },
  still_needed: { min: 0, max: 5000, step: 25, label: 'Still Needed ($)', helpText: 'How much is still needed to fully fund the loan.' },
  loan_amount: { min: 0, max: 10000, step: 25, label: 'Loan Amount ($)', helpText: 'How much is the loan for?' },
  dollars_per_hour: { min: 0, max: 500, label: '$/Hour', helpText: 'Funded amounts / time since posting.' },
  percent_funded: { min: 0, max: 100, step: 1, label: 'Funded (%)', helpText: 'What percent of the loan has been funded (includes basket amounts).' },
  expiring_in_days: { min: 0, max: 35, label: 'Expiring In (days)', helpText: 'Days left before the loan expires.' },
  disbursal_in_days: { min: -90, max: 90, label: 'Disbursal (days)', helpText: 'When does the borrower get the money relative to today?' },
}

const PARTNER_SLIDERS: Record<string, SliderConfig> = {
  partner_risk_rating: { min: 0, max: 5, step: 0.5, label: 'Risk Rating (stars)', helpText: '5 star = very low probability of collapse.' },
  partner_arrears: { min: 0, max: 100, step: 0.1, label: 'Delinq Rate (%)', helpText: 'Amount of late payments / total outstanding balance.' },
  loans_at_risk_rate: { min: 0, max: 100, label: 'Loans at Risk (%)', helpText: 'Percentage of loans past due by at least 1 day.' },
  partner_default: { min: 0, max: 30, step: 0.1, label: 'Default Rate (%)', helpText: 'Percentage of ended loans that defaulted.' },
  portfolio_yield: { min: 0, max: 100, step: 0.1, label: 'Portfolio Yield (%)', helpText: 'Interest/fees charged by the field partner.' },
  profit: { min: -100, max: 100, step: 0.1, label: 'Profit (%)', helpText: 'Return on Assets indicator.' },
  currency_exchange_loss_rate: { min: 0, max: 10, step: 0.1, label: 'Currency Exchange Loss (%)', helpText: 'Currency exchange loss rate.' },
  average_loan_size_percent_per_capita_income: { min: 0, max: 300, label: 'Average Loan/Capita Income', helpText: 'Average loan as percentage of national income per capita.' },
  years_on_kiva: { min: 0, max: 12, step: 0.25, label: 'Years on Kiva', helpText: 'How long the partner has been on Kiva.' },
  loans_posted: { min: 0, max: 20000, step: 50, label: 'Loans Posted', helpText: 'How many loans the partner has posted to Kiva.' },
  fundraising_loan_count: { min: 0, max: 200, step: 1, label: 'Fundraising Loans', helpText: 'How many loans from this partner are currently fundraising on Kiva.' },
}

// Balancer configs
interface BalancerMeta {
  label: string
  sliceBy: string
  key?: string
}

// Options list per criteria key — used to map a clicked distribution bar's
// display name back to the stored option value.
const OPTIONS_BY_KEY: Record<string, SelectOption[]> = {
  country_code: COUNTRY_OPTIONS,
  sector: SECTOR_OPTIONS,
  activity: ACTIVITY_OPTIONS,
  themes: THEME_OPTIONS,
  tags: TAG_OPTIONS,
  repayment_interval: REPAYMENT_INTERVAL_OPTIONS,
  currency_exchange_loss_liability: CURRENCY_LOSS_OPTIONS,
  bonus_credit_eligibility: BONUS_CREDIT_OPTIONS,
  direct: DIRECT_OPTIONS,
  region: REGION_OPTIONS,
  social_performance: SOCIAL_PERFORMANCE_OPTIONS,
  charges_fees_and_interest: CHARGES_INTEREST_OPTIONS,
  religion: RELIGION_OPTIONS,
}

/** Facets whose criteria value is a single selection rather than a CSV. */
const SINGLE_VALUE_KEYS = new Set([
  'bonus_credit_eligibility',
  'direct',
  'charges_fees_and_interest',
])

const BALANCER_OPTIONS: Record<string, BalancerMeta> = {
  pb_partner: { label: 'Partners', sliceBy: 'partner', key: 'id' },
  pb_country: { label: 'Countries', sliceBy: 'country' },
  pb_sector: { label: 'Sectors', sliceBy: 'sector' },
  pb_activity: { label: 'Activities', sliceBy: 'activity' },
}

// ---------------------------------------------------------------------------
// Utility: parse comma-separated string to multi-select values and back
// ---------------------------------------------------------------------------

function csvToOptions(csv: unknown, optionsList: SelectOption[]): SelectOption[] {
  if (!csv) return []
  const values = String(csv).split(',').filter(Boolean)
  return values
    .map((v) => optionsList.find((o) => o.value === v))
    .filter((o): o is SelectOption => o !== undefined)
}

function optionsToCsv(opts: MultiValue<SelectOption>): string {
  return opts.map((o) => o.value).join(',')
}

function getPartnerForLoan(loan: KivaLoan, lookup: { getPartner: (id: number) => Partner | undefined }): Partner | null {
  if (loan.getPartner) {
    return loan.getPartner() ?? null
  }
  if (loan.kl_partner) {
    return loan.kl_partner
  }
  if (loan.partner_id == null) {
    return null
  }
  return lookup.getPartner(loan.partner_id) ?? null
}

function groupForHelperChart(
  loans: KivaLoan[],
  title: string,
  extractor: (loan: KivaLoan) => string | string[] | null | undefined,
): HelperChart | null {
  const counts = new Map<string, number>()

  for (const loan of loans) {
    const rawValues = extractor(loan)
    if (rawValues == null) continue
    const values = Array.isArray(rawValues) ? rawValues : [rawValues]
    const uniqueValues = new Set(
      values
        .map((value) => String(value).trim())
        .filter((value) => value.length > 0),
    )

    for (const value of uniqueValues) {
      counts.set(value, (counts.get(value) ?? 0) + 1)
    }
  }

  const data = Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 20)

  return data.length ? { title, data } : null
}

function buildHelperChart(loans: KivaLoan[], key: string): HelperChart | null {
  const kl = getKivaLoans()
  if (!kl) return null

  switch (key) {
    case 'country_code':
      return groupForHelperChart(loans, 'Countries', (loan) => loan.location.country)
    case 'sector':
      return groupForHelperChart(loans, 'Sectors', (loan) => loan.sector)
    case 'activity':
      return groupForHelperChart(loans, 'Activities', (loan) => loan.activity)
    case 'themes':
      return groupForHelperChart(loans, 'Themes', (loan) => loan.themes ?? [])
    case 'tags':
      return groupForHelperChart(loans, 'Tags', (loan) => (loan.kls_tags ?? []).map((tag) => humanize(tag)))
    case 'repayment_interval':
      return groupForHelperChart(loans, 'Repayment Interval', (loan) => loan.terms.repayment_interval ?? 'Unknown')
    case 'currency_exchange_loss_liability':
      return groupForHelperChart(loans, 'Currency Loss', (loan) => humanize(loan.terms.loss_liability?.currency_exchange ?? 'unknown'))
    case 'bonus_credit_eligibility':
      return groupForHelperChart(loans, 'Bonus Credit', (loan) => loan.bonus_credit_eligibility ? 'Eligible' : 'Not Eligible')
    case 'direct':
      return groupForHelperChart(loans, 'MFI or Direct', (loan) => loan.partner_id == null ? 'Direct' : 'MFI')
    case 'region':
      return groupForHelperChart(loans, 'Region', (loan) => {
        const partner = getPartnerForLoan(loan, kl)
        const regions =
          partner?.kl_regions ?? partner?.countries.map((country) => country.region) ?? []
        // kl_regions are codes (e.g. 'sa'); map to readable labels. Full region
        // names from the countries fallback pass through unchanged.
        return regions.map((r) => REGION_LABELS[r] ?? r)
      })
    case 'social_performance':
      return groupForHelperChart(loans, 'Social Performance', (loan) => {
        const partner = getPartnerForLoan(loan, kl)
        return (partner?.social_performance_strengths ?? []).map((strength) =>
          SOCIAL_PERFORMANCE_LABELS[String(strength.id)] ?? String(strength.id),
        )
      })
    case 'charges_fees_and_interest':
      return groupForHelperChart(loans, 'Charges Interest', (loan) => {
        const partner = getPartnerForLoan(loan, kl)
        return partner?.charges_fees_and_interest ? 'Charges fees and interest' : 'Does not charge fees and interest'
      })
    case 'religion':
      return groupForHelperChart(loans, 'Religion', (loan) => {
        const partner = getPartnerForLoan(loan, kl)
        return partner?.normalizedReligions?.length ? partner.normalizedReligions : ['Unknown']
      })
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Sub-component: InputRow (debounced text input)
// ---------------------------------------------------------------------------

function InputRow({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string
  value: string
  onChange: (val: string) => void
  disabled?: boolean
}) {
  const [local, setLocal] = useState(value)
  const prevValueRef = useRef(value)

  // Sync from parent when criteria is reloaded
  useEffect(() => {
    if (value !== prevValueRef.current) {
      setLocal(value)
      prevValueRef.current = value
    }
  }, [value])

  useDebouncedEffect(
    () => {
      if (local !== value) {
        onChange(local)
      }
    },
    [local],
    300,
  )

  return (
    <Row className="mb-2">
      <Col md={3}>
        <Form.Label>{label}</Form.Label>
      </Col>
      <Col md={9}>
        <Form.Control
          type="text"
          size="sm"
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          disabled={disabled}
        />
      </Col>
    </Row>
  )
}

// ---------------------------------------------------------------------------
// Sub-component: AllAnyNoneButton
// ---------------------------------------------------------------------------

function AllAnyNoneButton({
  value,
  onChange,
  canAll,
}: {
  value: string
  onChange: (val: string) => void
  canAll?: boolean
}) {
  const selected = value || (canAll ? 'all' : 'any')
  const styles: Record<string, string> = canAll
    ? { all: 'success', any: 'primary', none: 'danger' }
    : { any: 'success', none: 'danger' }

  return (
    <Dropdown>
      <Dropdown.Toggle
        size="sm"
        variant={styles[selected] ?? 'primary'}
        id="aan-dropdown"
        style={{ height: 34, padding: '4px 8px', width: 53 }}
      >
        {selected}
      </Dropdown.Toggle>
      <Dropdown.Menu>
        {canAll ? <Dropdown.Item onClick={() => onChange('all')}>All of these</Dropdown.Item> : null}
        <Dropdown.Item onClick={() => onChange('any')}>Any of these</Dropdown.Item>
        <Dropdown.Item onClick={() => onChange('none')}>None of these</Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>
  )
}

// ---------------------------------------------------------------------------
// Sub-component: SelectRow (multi or single select with optional AAN)
// ---------------------------------------------------------------------------

function SelectRow({
  label,
  options,
  isMulti,
  value,
  aanValue,
  onChange,
  onAanChange,
  helpText,
  canAll,
  onInspect,
  onInspectEnd,
}: {
  label: string
  options: SelectOption[]
  isMulti: boolean
  value: unknown
  aanValue?: string
  onChange: (val: string) => void
  onAanChange?: (val: string) => void
  helpText?: string
  canAll?: boolean
  /** focus/menu-open: reports the facet's viewport top for the floating graph */
  onInspect?: (top?: number) => void
  /** blur: lets the parent dismiss the floating graph (with a grace delay) */
  onInspectEnd?: () => void
}) {
  // react-select refocuses its input right after its menu closes; that
  // spurious focus must not (re-)arm this row's distribution graph.
  const selfSuppressUntil = useRef(0)

  const selectedOptions = useMemo(() => {
    if (!isMulti) {
      return options.find((o) => o.value === String(value ?? '')) ?? null
    }
    return csvToOptions(value, options)
  }, [value, options, isMulti])

  const handleChange = useCallback(
    (newVal: MultiValue<SelectOption> | SingleValue<SelectOption>) => {
      if (isMulti) {
        onChange(optionsToCsv(newVal as MultiValue<SelectOption>))
      } else {
        onChange((newVal as SingleValue<SelectOption>)?.value ?? '')
      }
    },
    [isMulti, onChange],
  )

  const labelEl = helpText ? (
    <OverlayTrigger
      trigger={['hover', 'focus']}
      placement="top"
      overlay={<Popover id={`pop-${label}`}><Popover.Body>{helpText}</Popover.Body></Popover>}
    >
      <Form.Label style={{ borderBottom: '#333 1px dotted', cursor: 'help' }}>{label}</Form.Label>
    </OverlayTrigger>
  ) : (
    <Form.Label>{label}</Form.Label>
  )

  return (
    <Row className="mb-2 align-items-start">
      <Col md={3}>{labelEl}</Col>
      <Col md={9}>
        <div style={{ display: 'flex', gap: 4, alignItems: 'flex-start' }}>
          {onAanChange ? (
            <AllAnyNoneButton value={aanValue ?? ''} onChange={onAanChange} canAll={canAll} />
          ) : null}
          <div style={{ flex: 1 }}>
            <Select<SelectOption, boolean>
              isMulti={isMulti}
              options={options}
              value={selectedOptions}
              onChange={handleChange as (newVal: MultiValue<SelectOption> | SingleValue<SelectOption>) => void}
              onFocus={(e) => {
                if (Date.now() < selfSuppressUntil.current) return
                onInspect?.((e.target as HTMLElement)?.getBoundingClientRect?.().top)
              }}
              onMenuOpen={() => onInspect?.()}
              onMenuClose={() => {
                selfSuppressUntil.current = Date.now() + 300
              }}
              onBlur={onInspectEnd}
              placeholder=""
              isClearable={isMulti}
              menuPortalTarget={document.body}
              styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }), control: (base) => ({ ...base, minHeight: 34 }) }}
            />
          </div>
        </div>
      </Col>
    </Row>
  )
}

// ---------------------------------------------------------------------------
// Sub-component: SliderRow (range slider with min/max display)
// ---------------------------------------------------------------------------

function SliderRow({
  config,
  minVal,
  maxVal,
  onChange,
}: {
  config: SliderConfig
  minVal: unknown
  maxVal: unknown
  onChange: (minV: number | null, maxV: number | null) => void
}) {
  const { min: oMin, max: oMax, step = 1, label, helpText } = config

  const cMin = minVal != null && !isNaN(Number(minVal)) ? Number(minVal) : null
  const cMax = maxVal != null && !isNaN(Number(maxVal)) ? Number(maxVal) : null

  const aMin = cMin ?? oMin
  const aMax = cMax ?? oMax

  const dMin = cMin === null || cMin === oMin ? 'min' : String(cMin)
  const dMax = cMax === null || cMax === oMax ? 'max' : String(cMax)

  const handleChange = useCallback(
    (vals: number | number[]) => {
      if (Array.isArray(vals) && vals.length === 2) {
        const newMin = vals[0] === oMin ? null : vals[0]
        const newMax = vals[1] === oMax ? null : vals[1]
        onChange(newMin, newMax)
      }
    },
    [oMin, oMax, onChange],
  )

  const labelEl = helpText ? (
    <OverlayTrigger
      trigger={['hover', 'focus']}
      placement="top"
      overlay={<Popover id={`pop-${label}`}><Popover.Body>{helpText}</Popover.Body></Popover>}
    >
      <Form.Label style={{ borderBottom: '#333 1px dotted', cursor: 'help' }}>{label}</Form.Label>
    </OverlayTrigger>
  ) : (
    <Form.Label>{label}</Form.Label>
  )

  return (
    <Row className="mb-3">
      <Col md={3}>
        {labelEl}
        <div style={{ fontSize: 12, color: '#666' }}>
          {dMin} &ndash; {dMax}
        </div>
      </Col>
      <Col md={9} style={{ paddingTop: 8 }}>
        <Slider
          range
          min={oMin}
          max={oMax}
          step={step}
          value={[aMin, aMax]}
          onChange={handleChange}
        />
      </Col>
    </Row>
  )
}

// ---------------------------------------------------------------------------
// Sub-component: LimitResultRow
// ---------------------------------------------------------------------------

function LimitResultRow({
  value,
  onChange,
}: {
  value: { enabled?: boolean; count?: number; limit_by?: string } | undefined
  onChange: (val: { enabled?: boolean; count?: number; limit_by?: string }) => void
}) {
  const v = value ?? { enabled: false, count: 1, limit_by: 'Partner' }

  return (
    <Row className="mb-2">
      <Col md={3}>
        <Form.Check
          type="checkbox"
          label={<strong>Limit to top</strong>}
          checked={!!v.enabled}
          onChange={(e) => onChange({ ...v, enabled: e.target.checked })}
        />
      </Col>
      <Col md={9}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <Form.Control
            type="number"
            size="sm"
            style={{ width: 60 }}
            value={v.count ?? 1}
            disabled={!v.enabled}
            onChange={(e) => onChange({ ...v, count: parseInt(e.target.value) || 1 })}
          />
          <span style={{ fontSize: 12 }}>loans per</span>
          <div style={{ flex: 1 }}>
            <Select<SelectOption, false>
              options={[
                { value: 'Partner', label: 'Partner' },
                { value: 'Country', label: 'Country' },
                { value: 'Sector', label: 'Sector' },
                { value: 'Activity', label: 'Activity' },
              ]}
              value={{ value: v.limit_by ?? 'Partner', label: v.limit_by ?? 'Partner' }}
              isDisabled={!v.enabled}
              isClearable={false}
              onChange={(opt) => onChange({ ...v, limit_by: opt?.value ?? 'Partner' })}
              styles={{ control: (base) => ({ ...base, minHeight: 34 }) }}
            />
          </div>
        </div>
      </Col>
    </Row>
  )
}

// ---------------------------------------------------------------------------
// Sub-component: BalancingRow
// ---------------------------------------------------------------------------

function BalancingRow({
  name,
  meta,
  value,
  onChange,
}: {
  name: string
  meta: BalancerMeta
  value: BalancerConfig | undefined
  onChange: (val: BalancerConfig) => void
}) {
  const fetchBalancerData = useCriteriaStore((s) => s.fetchBalancerData)

  const v: BalancerConfig & { values?: unknown[] } = {
    enabled: false,
    hideshow: 'hide',
    ltgt: 'lt',
    percent: 10,
    allactive: 'all',
    ...value,
  }

  const [slices, setSlices] = useState<BalancerResult['slices']>([])
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<string | undefined>()

  useEffect(() => {
    if (!v.enabled) {
      setSlices([])
      return
    }
    let cancelled = false
    setLoading(true)
    fetchBalancerData(meta.sliceBy, v)
      .then((result) => {
        if (cancelled) return
        const pct = v.percent ?? 0
        const filtered = v.ltgt === 'gt'
          ? result.slices.filter((s) => s.percent > pct)
          : result.slices.filter((s) => s.percent < pct)
        setSlices(filtered)
        setLastUpdated(result.last_updated)
        setLoading(false)

        // Propagate values upward
        const values = meta.key === 'id'
          ? filtered.map((s) => parseInt(String(s.id))).filter((x) => !isNaN(x))
          : filtered.map((s) => s.name).filter((x): x is string => x != null)
        onChange({ ...v, values })
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
    // We only want to refetch when these specific config values change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.enabled, v.hideshow, v.ltgt, v.percent, v.allactive, meta.sliceBy, fetchBalancerData])

  return (
    <Row className="mb-3">
      <Col md={2}>
        <Form.Label>{meta.label}</Form.Label>
      </Col>
      <Col md={10}>
        <Form.Check
          type="checkbox"
          label="Enable filter"
          checked={!!v.enabled}
          onChange={(e) => onChange({ ...v, enabled: e.target.checked })}
          className="mb-1"
        />
        {v.enabled ? (
          <>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap', fontSize: 13 }}>
              <Dropdown>
                <Dropdown.Toggle size="sm" variant="primary" id={`bal-hs-${name}`}>
                  {v.hideshow === 'show' ? 'Show' : 'Hide'}
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  <Dropdown.Item onClick={() => onChange({ ...v, hideshow: 'show' })}>Only Show</Dropdown.Item>
                  <Dropdown.Item onClick={() => onChange({ ...v, hideshow: 'hide' })}>Hide all</Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
              <span>{meta.label.toLowerCase()} that have</span>
              <Dropdown>
                <Dropdown.Toggle size="sm" variant="primary" id={`bal-lg-${name}`}>
                  {v.ltgt === 'gt' ? '>' : '<'}
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  <Dropdown.Item onClick={() => onChange({ ...v, ltgt: 'lt' })}>&lt; Less than</Dropdown.Item>
                  <Dropdown.Item onClick={() => onChange({ ...v, ltgt: 'gt' })}>&gt; More than</Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
              <Form.Control
                type="number"
                size="sm"
                style={{ width: 60 }}
                value={v.percent ?? 0}
                onChange={(e) => onChange({ ...v, percent: parseFloat(e.target.value) || 0 })}
              />
              <span>% of my</span>
              <Dropdown>
                <Dropdown.Toggle size="sm" variant="primary" id={`bal-aa-${name}`}>
                  {v.allactive === 'all' ? 'Total' : 'Active'}
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  <Dropdown.Item onClick={() => onChange({ ...v, allactive: 'active' })}>Active Portfolio</Dropdown.Item>
                  <Dropdown.Item onClick={() => onChange({ ...v, allactive: 'all' })}>Total Portfolio</Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            </div>

            <div className="mt-2">
              {loading ? <Alert variant="info" className="py-1">Loading data from Kiva...</Alert> : null}
              {!loading ? (
                <div>
                  <span style={{ fontSize: 13 }}>
                    Matching: {slices.length}. Loans from these <strong>{meta.label.toLowerCase()}</strong> will
                    be <strong>{v.hideshow === 'show' ? 'shown' : 'hidden'}</strong>.
                  </span>
                  {slices.length > 0 ? (
                    <ul style={{ overflowY: 'auto', maxHeight: 200, fontSize: 12, marginTop: 4 }}>
                      {slices.map((slice, i) => (
                        <li key={i}>
                          {numeral(slice.percent).format('0.000')}%: {slice.name}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {lastUpdated ? (
                    <p style={{ fontSize: 11, color: '#999' }}>
                      Last updated: {new Date(Number(lastUpdated) * 1000).toLocaleString()}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </Col>
    </Row>
  )
}

// ---------------------------------------------------------------------------
// Option discovery — each facet's dropdown is the union of three sources:
//   1. the server's authoritative taxonomy from Kiva's GraphQL (allOptions),
//   2. the hard-coded *_OPTIONS baseline (offline fallback / belt-and-braces),
//   3. distinct values actually present in the loaded loans.
// This guarantees the most complete list (incl. values with zero current
// loans) and never drops a value the loans use. Sorted by label.
// ---------------------------------------------------------------------------

/** Union the option lists by value (earlier lists win on collision, so the
 *  server's nicer labels take precedence), then sort by label. */
function mergeByValue(...lists: SelectOption[][]): SelectOption[] {
  const byValue = new Map<string, SelectOption>()
  for (const list of lists) {
    for (const o of list) {
      if (o.value && !byValue.has(o.value)) byValue.set(o.value, o)
    }
  }
  return [...byValue.values()].sort((a, b) => a.label.localeCompare(b.label))
}

function useDiscoveredOptions() {
  // Recompute when the loaded loan total changes or server options arrive.
  const loanCount = useLoanStore((s) => s.loanCount)
  const serverOptions = useCriteriaStore((s) => s.allOptions)
  return useMemo(() => {
    const loans = getKivaLoans()?.loansFromKiva ?? []
    const sectors = new Set<string>()
    const activities = new Set<string>()
    const themes = new Set<string>()
    const tags = new Set<string>()
    for (const l of loans) {
      if (l.sector) sectors.add(l.sector)
      if (l.activity) activities.add(l.activity)
      for (const t of l.themes ?? []) if (t) themes.add(t)
      for (const t of l.kls_tags ?? []) if (t) tags.add(t)
    }
    const discovered = (set: Set<string>): SelectOption[] =>
      [...set].map((v) => ({ value: v, label: v }))
    return {
      sector: mergeByValue(serverOptions.sectors ?? [], SECTOR_OPTIONS, discovered(sectors)),
      activity: mergeByValue(serverOptions.activities ?? [], ACTIVITY_OPTIONS, discovered(activities)),
      themes: mergeByValue(serverOptions.themes ?? [], THEME_OPTIONS, discovered(themes)),
      tags: mergeByValue(serverOptions.tags ?? [], TAG_OPTIONS, discovered(tags)),
    }
    // loanCount/serverOptions are the triggers; loans are read imperatively.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loanCount, serverOptions])
}

// ---------------------------------------------------------------------------
// Sub-component: LoanCriteriaPanel
// ---------------------------------------------------------------------------

function LoanCriteriaPanel({
  criteria,
  onUpdate,
  onInspectSelect,
  onInspectEnd,
}: {
  criteria: Criteria
  onUpdate: (group: 'loan' | 'partner' | 'portfolio', key: string, value: unknown) => void
  onInspectSelect: (group: 'loan' | 'partner', key: string, canAll?: boolean, top?: number) => void
  onInspectEnd: () => void
}) {
  const loan = criteria.loan as Record<string, unknown>
  const discovered = useDiscoveredOptions()

  const loanSelects: Array<{
    key: string; label: string; options: SelectOption[]; isMulti: boolean
    hasAan?: boolean; canAll?: boolean; helpText?: string; showDistribution?: boolean
  }> = [
    { key: 'country_code', label: 'Countries', options: COUNTRY_OPTIONS, isMulti: true, hasAan: true, showDistribution: true },
    { key: 'sector', label: 'Sectors', options: discovered.sector, isMulti: true, hasAan: true, showDistribution: true },
    { key: 'activity', label: 'Activities', options: discovered.activity, isMulti: true, hasAan: true, showDistribution: true },
    { key: 'themes', label: 'Themes', options: discovered.themes, isMulti: true, hasAan: true, canAll: true, showDistribution: true },
    { key: 'tags', label: 'Tags', options: discovered.tags, isMulti: true, hasAan: true, canAll: true, showDistribution: true },
    { key: 'repayment_interval', label: 'Repayment Interval', options: REPAYMENT_INTERVAL_OPTIONS, isMulti: true, showDistribution: true },
    { key: 'currency_exchange_loss_liability', label: 'Currency Loss', options: CURRENCY_LOSS_OPTIONS, isMulti: true, showDistribution: true },
    { key: 'bonus_credit_eligibility', label: 'Bonus Credit', options: BONUS_CREDIT_OPTIONS, isMulti: false, showDistribution: true },
    { key: 'sort', label: 'Sort', options: SORT_OPTIONS, isMulti: false },
  ]

  return (
    <>
      <InputRow
        label="Use or Description"
        value={String(loan['use'] ?? '')}
        onChange={(val) => onUpdate('loan', 'use', val)}
      />
      <InputRow
        label="Name"
        value={String(loan['name'] ?? '')}
        onChange={(val) => onUpdate('loan', 'name', val)}
      />

      {loanSelects.map((sel) => (
        <SelectRow
          key={sel.key}
          label={sel.label}
          options={sel.options}
          isMulti={sel.isMulti}
          value={loan[sel.key]}
          aanValue={sel.hasAan ? String(loan[`${sel.key}_all_any_none`] ?? '') : undefined}
          onChange={(val) => onUpdate('loan', sel.key, val)}
          onAanChange={sel.hasAan ? (val) => onUpdate('loan', `${sel.key}_all_any_none`, val) : undefined}
          helpText={sel.helpText}
          canAll={sel.canAll}
          onInspect={sel.showDistribution ? (top) => onInspectSelect('loan', sel.key, sel.canAll, top) : undefined}
          onInspectEnd={onInspectEnd}
        />
      ))}

      <LimitResultRow
        value={loan['limit_to'] as { enabled?: boolean; count?: number; limit_by?: string } | undefined}
        onChange={(val) => onUpdate('loan', 'limit_to', val)}
      />

      {Object.entries(LOAN_SLIDERS).map(([key, config]) => (
        <SliderRow
          key={key}
          config={config}
          minVal={loan[`${key}_min`]}
          maxVal={loan[`${key}_max`]}
          onChange={(minV, maxV) => {
            onUpdate('loan', `${key}_min`, minV)
            onUpdate('loan', `${key}_max`, maxV)
          }}
        />
      ))}
    </>
  )
}

// ---------------------------------------------------------------------------
// Sub-component: PartnerCriteriaPanel
// ---------------------------------------------------------------------------

/** Field-partner (MFI) options for the partner picker, built from the loaded
 *  active partners. Recomputes when the loaded loan total changes (partners
 *  arrive alongside the loan data). Sorted by name. */
function usePartnerOptions(): SelectOption[] {
  const loanCount = useLoanStore((s) => s.loanCount)
  return useMemo(() => {
    const partners = getKivaLoans()?.activePartners ?? []
    return partners
      .map((p) => ({ value: String(p.id), label: p.name }))
      .sort((a, b) => a.label.localeCompare(b.label))
    // loanCount is the trigger; activePartners is read imperatively.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loanCount])
}

function PartnerCriteriaPanel({
  criteria,
  onUpdate,
  onInspectSelect,
  onInspectEnd,
}: {
  criteria: Criteria
  onUpdate: (group: 'loan' | 'partner' | 'portfolio', key: string, value: unknown) => void
  onInspectSelect: (group: 'loan' | 'partner', key: string, canAll?: boolean, top?: number) => void
  onInspectEnd: () => void
}) {
  const partner = criteria.partner as Record<string, unknown>
  const partnerOptions = usePartnerOptions()

  const partnerSelects: Array<{
    key: string; label: string; options: SelectOption[]; isMulti: boolean
    hasAan?: boolean; canAll?: boolean; helpText?: string; showDistribution?: boolean
  }> = [
    { key: 'direct', label: 'MFI or Direct', options: DIRECT_OPTIONS, isMulti: false, showDistribution: true },
    { key: 'partners', label: 'Field Partner', options: partnerOptions, isMulti: true, hasAan: true,
      helpText: 'Pick specific field partners (MFIs). Use the Any/None toggle to require loans from any of the selected partners, or to exclude them. Only applies in MFI mode.' },
    { key: 'region', label: 'Region', options: REGION_OPTIONS, isMulti: true, hasAan: true, showDistribution: true },
    { key: 'social_performance', label: 'Social Performance', options: SOCIAL_PERFORMANCE_OPTIONS, isMulti: true, hasAan: true, canAll: true, showDistribution: true },
    { key: 'charges_fees_and_interest', label: 'Charges Interest', options: CHARGES_INTEREST_OPTIONS, isMulti: false, showDistribution: true },
    { key: 'religion', label: 'Religion', options: RELIGION_OPTIONS, isMulti: true, hasAan: true, showDistribution: true },
  ]

  return (
    <>
      {partnerSelects.map((sel) => (
        <SelectRow
          key={sel.key}
          label={sel.label}
          options={sel.options}
          isMulti={sel.isMulti}
          value={partner[sel.key]}
          aanValue={sel.hasAan ? String(partner[`${sel.key}_all_any_none`] ?? '') : undefined}
          onChange={(val) => onUpdate('partner', sel.key, val)}
          onAanChange={sel.hasAan ? (val) => onUpdate('partner', `${sel.key}_all_any_none`, val) : undefined}
          helpText={sel.helpText}
          canAll={sel.canAll}
          onInspect={sel.showDistribution ? (top) => onInspectSelect('partner', sel.key, sel.canAll, top) : undefined}
          onInspectEnd={onInspectEnd}
        />
      ))}

      {Object.entries(PARTNER_SLIDERS).map(([key, config]) => (
        <SliderRow
          key={key}
          config={config}
          minVal={partner[`${key}_min`]}
          maxVal={partner[`${key}_max`]}
          onChange={(minV, maxV) => {
            onUpdate('partner', `${key}_min`, minV)
            onUpdate('partner', `${key}_max`, maxV)
          }}
        />
      ))}
    </>
  )
}

// ---------------------------------------------------------------------------
// Sub-component: PortfolioCriteriaPanel
// ---------------------------------------------------------------------------

function PortfolioCriteriaPanel({
  criteria,
  onUpdate,
}: {
  criteria: Criteria
  onUpdate: (group: 'loan' | 'partner' | 'portfolio', key: string, value: unknown) => void
}) {
  const portfolio = criteria.portfolio as Record<string, unknown>

  return (
    <>
      <SelectRow
        label="Exclude My Loans"
        options={EXCLUDE_PORTFOLIO_OPTIONS}
        isMulti={false}
        value={portfolio['exclude_portfolio_loans']}
        onChange={(val) => onUpdate('portfolio', 'exclude_portfolio_loans', val)}
      />

      <Card className="mt-3">
        <Card.Header>Portfolio Balancing</Card.Header>
        <Card.Body>
          <p style={{ fontSize: 13 }}>
            Balance your lending across partners, countries, sectors, and activities.
            Diversify to reduce risk or find new areas to lend in.
          </p>

          {Object.entries(BALANCER_OPTIONS).map(([key, meta]) => (
            <BalancingRow
              key={key}
              name={key}
              meta={meta}
              value={portfolio[key] as BalancerConfig | undefined}
              onChange={(val) => onUpdate('portfolio', key, val)}
            />
          ))}
        </Card.Body>
      </Card>
    </>
  )
}

// ---------------------------------------------------------------------------
// Main component: CriteriaTabs
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// RSS tab — feed configuration + criteria JSON + feed URL (ported from the
// original app; the URL targets the production KivaLens RSS endpoint)
// ---------------------------------------------------------------------------

function NewTabLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  )
}

function RSSPanel({ criteria }: { criteria: Criteria }) {
  const prepForRSS = useCriteriaStore((s) => s.prepForRSS)
  const [rssName, setRssName] = useState('')
  const [rssLinkTo, setRssLinkTo] = useState('kiva')

  const critRSS = useMemo(
    () => ({ feed: { name: rssName, link_to: rssLinkTo }, ...prepForRSS(criteria) }),
    [criteria, prepForRSS, rssName, rssLinkTo],
  )
  const critRSSUrl = encodeURIComponent(JSON.stringify(critRSS))

  return (
    <Row className="ample-padding-top">
      <Col lg={12}>
        <p>
          With an RSS feed, you can use any number of RSS Readers (including some browsers or
          browser extensions), or sites like{' '}
          <NewTabLink href="http://www.ifttt.com">IFTTT (If This Then That)</NewTabLink> to set up
          all sorts of actions in response to new items in the feed. You can set it to send you
          emails, SMS, Instant Messages, flash your lights, turn on your sprinklers... You have a
          lot of options! You can create as many RSS feeds as you want.{' '}
          <NewTabLink href="https://ifttt.com/recipes/147561-rss-feed-to-email">
            Create &apos;Recipe&apos; to send you an email when loans match your criteria
          </NewTabLink>
          .
        </p>
        <p>
          It will only show the first 100 matching loans and it currently doesn&apos;t support
          anything that requires any knowledge of your portfolio (excluding your fundraising loans
          or portfolio balancing).
        </p>
        <Card>
          <Card.Header>RSS Feed Details</Card.Header>
          <Card.Body>
            <Form.Group>
              <Form.Label>Name (this will appear in your RSS feed reader)</Form.Label>
              <Form.Control
                type="text"
                style={{ height: 38, minWidth: 50 }}
                value={rssName}
                onChange={(e) => setRssName(e.target.value)}
              />
            </Form.Group>
            <Form.Group>
              <Form.Label>Links in RSS go to</Form.Label>
              <Form.Select value={rssLinkTo} onChange={(e) => setRssLinkTo(e.target.value)}>
                <option value="kiva">Kiva</option>
                <option value="kivalens">KivaLens</option>
              </Form.Select>
            </Form.Group>
          </Card.Body>
        </Card>
        <Card>
          <Card.Header>Your Settings</Card.Header>
          <Card.Body>
            <p>
              These are the criteria options that will be used to generate your feed. Anything
              related to your portfolio has been removed.
            </p>
            <pre>{JSON.stringify(critRSS, null, 2)}</pre>
          </Card.Body>
        </Card>
        <Card>
          <Card.Header>RSS Link</Card.Header>
          <Card.Body>
            <p>
              Copy and Paste this entire URL into your RSS reader or use{' '}
              <NewTabLink href="http://www.ifttt.com">If This Then That</NewTabLink> to create a
              &quot;recipe&quot; to respond to new items in the news feed and either send you an
              email or an SMS.
            </p>
            <textarea
              style={{ width: '100%', height: 150 }}
              readOnly
              value={`https://www.kivalens.org/rss/${critRSSUrl}`}
            />
          </Card.Body>
        </Card>
      </Col>
    </Row>
  )
}


export function CriteriaTabs() {
  const lastKnown = useCriteriaStore((s) => s.lastKnown)
  const setCriteria = useCriteriaStore((s) => s.setCriteria)
  const filteredLoans = useLoanStore((s) => s.filteredLoans)

  // Local copy of criteria for debounced editing
  const [criteria, setCriteriaLocal] = useState<Criteria>(() => ({
    loan: { ...lastKnown.loan },
    partner: { ...lastKnown.partner },
    portfolio: { ...lastKnown.portfolio },
  }))

  const [activeTab, setActiveTab] = useState<string>('borrower')
  const [helperTarget, setHelperTarget] = useState<HelperChartTarget | null>(null)
  const [helperChart, setHelperChart] = useState<HelperChart | null>(null)
  const [graphTop, setGraphTop] = useState(100)
  const removeGraphTimer = useRef(0)
  // react-select refocuses its input after closing the menu on an outside
  // click; suppress that follow-up onFocus so it can't re-arm the graph.
  const suppressInspectUntil = useRef(0)
  const hideGraphs = !!lsj.get<{ hide_criteria_graphs?: boolean }>('Options').hide_criteria_graphs

  // Sync from store when criteria is reloaded externally (saved search load, reset)
  const prevLastKnownRef = useRef(lastKnown)
  useEffect(() => {
    if (lastKnown !== prevLastKnownRef.current) {
      prevLastKnownRef.current = lastKnown
      setCriteriaLocal({
        loan: { ...lastKnown.loan },
        partner: { ...lastKnown.partner },
        portfolio: { ...lastKnown.portfolio },
      })
    }
  }, [lastKnown])

  // Debounced push to store triggers loan filtering
  useDebouncedEffect(
    () => {
      setCriteria(criteria)
    },
    [criteria],
    300,
  )

  const handleUpdate = useCallback(
    (group: 'loan' | 'partner' | 'portfolio', key: string, value: unknown) => {
      setCriteriaLocal((prev) => {
        const updated = {
          ...prev,
          [group]: { ...prev[group], [key]: value },
        }
        return updated
      })
    },
    [],
  )

  const handleInspectSelect = useCallback(
    (group: 'loan' | 'partner', key: string, canAll = false, top?: number) => {
      if (hideGraphs) return
      if (Date.now() < suppressInspectUntil.current) return
      window.clearTimeout(removeGraphTimer.current)
      if (top != null) setGraphTop(Math.max(60, top))
      setHelperTarget({ group, key, canAll })
    },
    [hideGraphs],
  )

  // Delay removal on blur so clicks inside the popover land first
  const handleInspectEnd = useCallback(() => {
    window.clearTimeout(removeGraphTimer.current)
    removeGraphTimer.current = window.setTimeout(() => {
      setHelperTarget(null)
      setHelperChart(null)
    }, 200)
  }, [])

  // Clicking a distribution bar selects that value in the facet's control.
  const handleBarClick = useCallback(
    (name: string) => {
      if (!helperTarget || !name) return
      const { group, key } = helperTarget
      const options = OPTIONS_BY_KEY[key]
      if (!options) return
      const match = options.find(
        (o) =>
          o.label === name ||
          String(o.value) === name ||
          humanize(String(o.value)) === name,
      )
      if (!match) return

      if (SINGLE_VALUE_KEYS.has(key)) {
        handleUpdate(group, key, String(match.value))
        return
      }
      const current = String(
        (criteria[group] as Record<string, unknown>)[key] ?? '',
      )
      const values = current ? current.split(',').filter(Boolean) : []
      if (!values.includes(String(match.value))) {
        values.push(String(match.value))
        handleUpdate(group, key, values.join(','))
      }
    },
    [helperTarget, criteria, handleUpdate],
  )

  useEffect(() => () => window.clearTimeout(removeGraphTimer.current), [])

  // Blur alone is unreliable (react-select refocuses internally on menu
  // close), so also dismiss on any mousedown outside the popover/selects.
  useEffect(() => {
    if (!helperChart) return
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as Element | null
      if (!target?.closest) return
      if (target.closest('.kl-helper-popover')) return
      if (target.closest('[class*="Select__"]')) return
      suppressInspectUntil.current = Date.now() + 400
      window.clearTimeout(removeGraphTimer.current)
      setHelperTarget(null)
      setHelperChart(null)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [helperChart, handleInspectEnd])

  useEffect(() => {
    if (!helperTarget || hideGraphs) {
      setHelperChart(null)
      return
    }

    const kl = getKivaLoans()
    if (!kl?.isReady()) {
      setHelperChart(null)
      return
    }

    const nextCriteria: Criteria = {
      loan: { ...criteria.loan },
      partner: { ...criteria.partner },
      portfolio: { ...criteria.portfolio },
    }
    const groupCriteria = nextCriteria[helperTarget.group] as Record<string, unknown>
    const aanKey = `${helperTarget.key}_all_any_none`
    const ignoreCurrentValue =
      groupCriteria[aanKey] === 'all' || (!!helperTarget.canAll && !groupCriteria[aanKey])

    let loans = filteredLoans
    if (!ignoreCurrentValue) {
      delete groupCriteria[helperTarget.key]
      delete groupCriteria[aanKey]
      loans = kl.filter(nextCriteria, false)
    }

    setHelperChart(buildHelperChart(loans, helperTarget.key))
  }, [criteria, filteredLoans, helperTarget, hideGraphs])

  const helperChartHeight = helperChart
    ? Math.max(280, Math.min(helperChart.data.length * 28, 700))
    : 0

  return (
    <div>
      <Tabs
        activeKey={activeTab}
        onSelect={(k) => {
          setActiveTab(k ?? 'borrower')
          setHelperTarget(null)
          setHelperChart(null)
        }}
        className="mb-2"
      >
        <Tab eventKey="borrower" title="Borrower">
          <div className="pt-2">
            <LoanCriteriaPanel
              criteria={criteria}
              onUpdate={handleUpdate}
              onInspectSelect={handleInspectSelect}
              onInspectEnd={handleInspectEnd}
            />
          </div>
        </Tab>

        <Tab eventKey="partner" title="Partner">
          <div className="pt-2">
            <PartnerCriteriaPanel
              criteria={criteria}
              onUpdate={handleUpdate}
              onInspectSelect={handleInspectSelect}
              onInspectEnd={handleInspectEnd}
            />
          </div>
        </Tab>

        <Tab eventKey="portfolio" title="Your Portfolio">
          <div className="pt-2">
            <PortfolioCriteriaPanel criteria={criteria} onUpdate={handleUpdate} />
          </div>
        </Tab>

        <Tab eventKey="rss" title="RSS">
          <div className="pt-2">
            <RSSPanel criteria={criteria} />
          </div>
        </Tab>
      </Tabs>

      {!hideGraphs && helperChart ? (
        // Floating distribution graph beside the focused facet, to the right
        // of the criteria column (original app behavior)
        <div
          className="kl-helper-popover d-none d-lg-block"
          style={{
            position: 'fixed',
            top: graphTop,
            left: 'calc(33.33% + 15px)',
            zIndex: 1050,
            background: '#fff',
            border: '1px solid #ccc',
            borderRadius: 8,
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            padding: '8px 12px',
            width: 320,
            maxHeight: '70vh',
            overflowY: 'auto',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>{helperChart.title}</span>
            <span>
              <span
                style={{ fontSize: 11, color: '#999', cursor: 'pointer', textDecoration: 'underline' }}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  lsj.setMerge('Options', { hide_criteria_graphs: true })
                  setHelperTarget(null)
                  setHelperChart(null)
                  void showAlert('Distribution graphs disabled. You can re-enable them in Options > Display.')
                }}
              >
                Do not show again
              </span>
              <span
                style={{ fontSize: 11, color: '#999', cursor: 'pointer', textDecoration: 'underline', marginLeft: 8 }}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setHelperTarget(null)
                  setHelperChart(null)
                }}
              >
                Close
              </span>
            </span>
          </div>
          <div>
            <ResponsiveContainer width="100%" height={helperChartHeight}>
              <BarChart
                data={helperChart.data}
                layout="vertical"
                margin={{ top: 6, right: 10, bottom: 6, left: 10 }}
              >
                <XAxis type="number" allowDecimals={false} />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={110}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value: string) =>
                    value.length > 18 ? `${value.slice(0, 18)}...` : value
                  }
                />
                <Tooltip formatter={(value) => [Number(value), 'Matching Loans']} />
                <Bar
                  dataKey="count"
                  fill="#2C8C5E"
                  radius={[0, 4, 4, 0]}
                  isAnimationActive={false}
                  cursor="pointer"
                  onClick={(entry: { payload?: { name?: string } }) =>
                    handleBarClick(String(entry?.payload?.name ?? ''))
                  }
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default CriteriaTabs
