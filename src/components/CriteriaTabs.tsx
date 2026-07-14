import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Row, Col, Tab, Tabs, Form, Dropdown, Card, Alert, OverlayTrigger, Popover, Modal, Button } from '../ui'
import Select from './KLSelect'
import type { MultiValue, SingleValue } from 'react-select'
import Slider from 'rc-slider'
// rc-slider base CSS is imported globally in main.tsx
import numeral from 'numeral'
import { useCriteriaStore, useLoanStore, useUtilsStore } from '../stores'
import { showLenderIDModal } from '../lib/showLenderIdModal'
import type { Criteria, BalancerConfig, KivaLoan, Partner } from '../types'
import type { BalancerResult } from '../stores/criteriaStore'
import { getKivaLoans } from '../api/kiva'
import { lsj } from '../lib/localStorage'
import { humanize } from '../lib/utils'
import { useI18n } from '../i18n'

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
  // A+ Team research scores (1-4). Only meaningful once the A+ data is merged
  // (Options > "Merge A+ Team's data"); the panel hides them until then. Dropped
  // in the rewrite — restored so loan & partner search can filter on them again.
  secular_rating: { min: 1, max: 4, step: 1, label: 'Secular Score (A+ Team)', helpText: '4 Completely secular; 3 Secular but some religious influence; 2 Nonsecular but lends without regard to belief; 1 Nonsecular with a religious agenda.' },
  social_rating: { min: 1, max: 4, step: 1, label: 'Social Score (A+ Team)', helpText: '4 Excellent, proactive social programs; 3 Good initiatives in most areas; 2 Social goals but few initiatives; 1 No attention to social goals.' },
}

// Partner-criteria help text, exported so the standalone Partners page shows
// the SAME hover hints as this Search > Partner criteria tab (single source —
// derived from PARTNER_SLIDERS above, so the two can't drift). Intentionally
// sharing constants from this component file; that disables fast-refresh for
// this module only (harmless), hence the react-refresh disables.
// eslint-disable-next-line react-refresh/only-export-components
export const PARTNER_SLIDER_HELP: Record<string, string> = Object.fromEntries(
  Object.entries(PARTNER_SLIDERS).map(([k, v]) => [k, v.helpText ?? '']),
)

export const RELIGION_HELP =
  'Field-partner religious-affiliation data comes from the A+ Team’s (Atheists, Agnostics, Skeptics, Freethinkers, Secular Humanists and the Non-Religious) research — it isn’t provided by Kiva.'

// Balancer configs
interface BalancerMeta {
  label: string
  sliceBy: string
  key?: string
}

// Options list per criteria key — used to map a clicked distribution bar's
// display name back to the stored option value.
const BALANCER_OPTIONS: Record<string, BalancerMeta> = {
  pb_partner: { label: 'Partners', sliceBy: 'partner', key: 'id' },
  pb_country: { label: 'Countries', sliceBy: 'country' },
  pb_region: { label: 'Regions', sliceBy: 'region' },
  pb_sector: { label: 'Sectors', sliceBy: 'sector' },
  pb_activity: { label: 'Activities', sliceBy: 'activity' },
  pb_gender: { label: 'Gender', sliceBy: 'gender' },
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

function buildHelperChart(
  loans: KivaLoan[],
  key: string,
  sector: (englishSector: string) => string = (value) => value,
  t: (key: string) => string = (value) => value,
): HelperChart | null {
  const kl = getKivaLoans()
  if (!kl) return null

  switch (key) {
    case 'country_code':
      return groupForHelperChart(loans, t('Countries'), (loan) => loan.location.country)
    case 'sector':
      return groupForHelperChart(loans, t('Sectors'), (loan) => sector(loan.sector))
    case 'activity':
      return groupForHelperChart(loans, t('Activities'), (loan) => loan.activity)
    case 'themes':
      return groupForHelperChart(loans, t('Themes'), (loan) => loan.themes ?? [])
    case 'tags':
      return groupForHelperChart(loans, t('Tags'), (loan) => (loan.kls_tags ?? []).map((tag) => humanize(tag)))
    case 'repayment_interval':
      return groupForHelperChart(loans, t('Repayment Interval'), (loan) => loan.terms.repayment_interval ?? 'Unknown')
    case 'currency_exchange_loss_liability':
      return groupForHelperChart(loans, t('Currency Loss'), (loan) => humanize(loan.terms.loss_liability?.currency_exchange ?? 'unknown'))
    case 'bonus_credit_eligibility':
      return groupForHelperChart(loans, t('Bonus Credit'), (loan) => t(loan.bonus_credit_eligibility ? 'Eligible' : 'Not Eligible'))
    case 'direct':
      return groupForHelperChart(loans, t('MFI or Direct'), (loan) => t(loan.partner_id == null ? 'Direct' : 'MFI'))
    case 'region':
      return groupForHelperChart(loans, t('Region'), (loan) => {
        const partner = getPartnerForLoan(loan, kl)
        const regions =
          partner?.kl_regions ?? partner?.countries.map((country) => country.region) ?? []
        // kl_regions are codes (e.g. 'sa'); map to readable labels. Full region
        // names from the countries fallback pass through unchanged.
        return regions.map((r) => REGION_LABELS[r] ?? r)
      })
    case 'social_performance':
      return groupForHelperChart(loans, t('Social Performance'), (loan) => {
        const partner = getPartnerForLoan(loan, kl)
        return (partner?.social_performance_strengths ?? []).map((strength) =>
          SOCIAL_PERFORMANCE_LABELS[String(strength.id)] ?? String(strength.id),
        )
      })
    case 'charges_fees_and_interest':
      return groupForHelperChart(loans, t('Charges Interest'), (loan) => {
        const partner = getPartnerForLoan(loan, kl)
        return t(partner?.charges_fees_and_interest ? 'Charges fees and interest' : 'Does not charge fees and interest')
      })
    case 'religion':
      return groupForHelperChart(loans, t('Religion'), (loan) => {
        const partner = getPartnerForLoan(loan, kl)
        return partner?.normalizedReligions?.length ? partner.normalizedReligions : [t('Unknown')]
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
  placeholder,
}: {
  label: string
  value: string
  onChange: (val: string) => void
  disabled?: boolean
  placeholder?: string
}) {
  const { t } = useI18n()
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
        <Form.Label>{t(label)}</Form.Label>
      </Col>
      <Col md={9}>
        <Form.Control
          type="text"
          size="sm"
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
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
  const { t } = useI18n()
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
        style={{ height: 34, padding: '4px 8px', minWidth: 53, width: 'max-content', whiteSpace: 'nowrap' }}
      >
        {t(selected)}
      </Dropdown.Toggle>
      <Dropdown.Menu>
        {canAll ? <Dropdown.Item onClick={() => onChange('all')}>{t('All of these')}</Dropdown.Item> : null}
        <Dropdown.Item onClick={() => onChange('any')}>{t('Any of these')}</Dropdown.Item>
        <Dropdown.Item onClick={() => onChange('none')}>{t('None of these')}</Dropdown.Item>
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
  fieldKey,
  distribution,
  sortMode,
  onSortMode,
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
  /** criteria field key — exposes data-aikl="crit-<key>" so the AI can point here */
  fieldKey?: string
  /** option label -> count; draws in-list distribution bars + the sort tabs */
  distribution?: Record<string, number>
  sortMode?: 'abc' | 'count'
  onSortMode?: (mode: 'abc' | 'count') => void
}) {
  const { t } = useI18n()
  const localizedLabel = t(label)
  const localizedHelp = helpText ? t(helpText) : undefined
  const localizedOptions = useMemo(() => options.map((option) => ({ ...option, label: t(option.label) })), [options, t])
  // react-select refocuses its input right after its menu closes; that
  // spurious focus must not (re-)arm this row's distribution graph.
  const selfSuppressUntil = useRef(0)

  const selectedOptions = useMemo(() => {
    if (!isMulti) {
      return localizedOptions.find((o) => o.value === String(value ?? '')) ?? null
    }
    return csvToOptions(value, localizedOptions)
  }, [value, localizedOptions, isMulti])

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

  const labelEl = localizedHelp ? (
    <OverlayTrigger
      trigger={['hover', 'focus']}
      placement="top"
      overlay={<Popover id={`pop-${label}`}><Popover.Body>{localizedHelp}</Popover.Body></Popover>}
    >
      <Form.Label style={{ borderBottom: '#333 1px dotted', cursor: 'help' }}>{localizedLabel}</Form.Label>
    </OverlayTrigger>
  ) : (
    <Form.Label>{localizedLabel}</Form.Label>
  )

  return (
    <Row className="mb-2 align-items-start" data-aikl={fieldKey ? `crit-${fieldKey}` : undefined}>
      <Col md={3}>{labelEl}</Col>
      <Col md={9}>
        <div style={{ display: 'flex', gap: 4, alignItems: 'flex-start' }}>
          {onAanChange ? (
            <AllAnyNoneButton value={aanValue ?? ''} onChange={onAanChange} canAll={canAll} />
          ) : null}
          <div style={{ flex: 1 }}>
            <Select<SelectOption, boolean>
              isMulti={isMulti}
              options={localizedOptions}
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
              distribution={distribution}
              sortMode={sortMode}
              onSortMode={onSortMode}
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
  const { t } = useI18n()
  const { min: oMin, max: oMax, step = 1, label, helpText } = config
  const localizedLabel = t(label)
  const localizedHelp = helpText ? t(helpText) : undefined

  const cMin = minVal != null && !isNaN(Number(minVal)) ? Number(minVal) : null
  const cMax = maxVal != null && !isNaN(Number(maxVal)) ? Number(maxVal) : null

  const aMin = cMin ?? oMin
  const aMax = cMax ?? oMax

  const dMin = cMin === null || cMin === oMin ? t('Min') : String(cMin)
  const dMax = cMax === null || cMax === oMax ? t('Max') : String(cMax)

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

  // Exact-value modal: type precise min/max, or check "not set" to drop that
  // bound entirely (no constraint). Lets users go beyond the slider's range/step.
  const [showModal, setShowModal] = useState(false)
  const [minUnset, setMinUnset] = useState(cMin === null)
  const [maxUnset, setMaxUnset] = useState(cMax === null)
  const [minDraft, setMinDraft] = useState<number>(cMin ?? oMin)
  const [maxDraft, setMaxDraft] = useState<number>(cMax ?? oMax)

  const openModal = () => {
    setMinUnset(cMin === null)
    setMaxUnset(cMax === null)
    setMinDraft(cMin ?? oMin)
    setMaxDraft(cMax ?? oMax)
    setShowModal(true)
  }

  const applyModal = () => {
    // A checked "not set" box — or an empty/invalid number — drops that bound
    // (no constraint) rather than writing NaN into the criteria.
    const bound = (unset: boolean, n: number) => (unset || Number.isNaN(n) ? null : n)
    onChange(bound(minUnset, minDraft), bound(maxUnset, maxDraft))
    setShowModal(false)
  }

  const labelEl = localizedHelp ? (
    <OverlayTrigger
      trigger={['hover', 'focus']}
      placement="top"
      overlay={<Popover id={`pop-${label}`}><Popover.Body>{localizedHelp}</Popover.Body></Popover>}
    >
      <Form.Label style={{ borderBottom: '#333 1px dotted', cursor: 'help' }}>{localizedLabel}</Form.Label>
    </OverlayTrigger>
  ) : (
    <Form.Label>{localizedLabel}</Form.Label>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <Slider
              range
              min={oMin}
              max={oMax}
              step={step}
              value={[aMin, aMax]}
              onChange={handleChange}
            />
          </div>
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={openModal}
            title={t('Set exact {label} minimum and maximum', { label: localizedLabel })}
            aria-label={t('Set exact {label} minimum and maximum', { label: localizedLabel })}
            style={{ flexShrink: 0, lineHeight: 1, padding: '2px 9px' }}
          >
            &hellip;
          </Button>
        </div>
      </Col>

      <Modal show={showModal} onHide={() => setShowModal(false)} size="sm" centered>
        <Modal.Header closeButton>
          <Modal.Title style={{ fontSize: 18 }}>{localizedLabel}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {helpText ? (
            <p className="text-muted" style={{ fontSize: 13 }}>{localizedHelp}</p>
          ) : null}
          {[
            { which: 'Min', unset: minUnset, setUnset: setMinUnset, draft: minDraft, setDraft: setMinDraft },
            { which: 'Max', unset: maxUnset, setUnset: setMaxUnset, draft: maxDraft, setDraft: setMaxDraft },
          ].map((r) => (
            <div key={r.which} className="d-flex align-items-center gap-2 mb-2">
              <span style={{ width: 36, fontWeight: 600 }}>{t(r.which)}</span>
              <Form.Check
                type="checkbox"
                label={t('not set')}
                checked={r.unset}
                onChange={(e) => r.setUnset(e.target.checked)}
              />
              <Form.Control
                type="number"
                size="sm"
                step={step}
                style={{ width: 120 }}
                value={r.unset ? '' : r.draft}
                disabled={r.unset}
                onChange={(e) => r.setDraft(Number(e.target.value))}
              />
            </div>
          ))}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" size="sm" onClick={() => setShowModal(false)}>
            {t('Cancel')}
          </Button>
          <Button variant="primary" size="sm" onClick={applyModal}>
            {t('Apply')}
          </Button>
        </Modal.Footer>
      </Modal>
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
  const { t } = useI18n()
  const v = value ?? { enabled: false, count: 1, limit_by: 'Partner' }

  return (
    <Row className="mb-2">
      <Col md={3}>
        <Form.Check
          type="checkbox"
          label={<strong>{t('Limit to top')}</strong>}
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
          <span style={{ fontSize: 12 }}>{t('loans per')}</span>
          <div style={{ flex: 1 }}>
            <Select<SelectOption, false>
              options={[
                { value: 'Partner', label: t('Partner') },
                { value: 'Country', label: t('Country') },
                { value: 'Sector', label: t('Sector') },
                { value: 'Activity', label: t('Activity') },
              ]}
              value={{ value: v.limit_by ?? 'Partner', label: t(v.limit_by ?? 'Partner') }}
              isDisabled={!v.enabled}
              isClearable={false}
              onChange={(opt) => onChange({ ...v, limit_by: opt?.value ?? 'Partner' })}
              // Portal the menu out of the scrollable criteria panel; otherwise
              // hovering the bottom option scrolls the container and react-select
              // resets the highlight back to the first option.
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
  const { t, sector, date } = useI18n()
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
        <Form.Label>{t(meta.label)}</Form.Label>
      </Col>
      <Col md={10}>
        <Form.Check
          type="checkbox"
          label={t('Enable filter')}
          checked={!!v.enabled}
          onChange={(e) => onChange({ ...v, enabled: e.target.checked })}
          className="mb-1"
        />
        {v.enabled ? (
          <>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap', fontSize: 13 }}>
              <Dropdown>
                <Dropdown.Toggle size="sm" variant="primary" id={`bal-hs-${name}`}>
                  {t(v.hideshow === 'show' ? 'Show' : 'Hide')}
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  <Dropdown.Item onClick={() => onChange({ ...v, hideshow: 'show' })}>{t('Only Show')}</Dropdown.Item>
                  <Dropdown.Item onClick={() => onChange({ ...v, hideshow: 'hide' })}>{t('Hide all')}</Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
              <span>{t('{category} that have', { category: t(meta.label).toLocaleLowerCase() })}</span>
              <Dropdown>
                <Dropdown.Toggle size="sm" variant="primary" id={`bal-lg-${name}`}>
                  {v.ltgt === 'gt' ? '>' : '<'}
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  <Dropdown.Item onClick={() => onChange({ ...v, ltgt: 'lt' })}>&lt; {t('Less than')}</Dropdown.Item>
                  <Dropdown.Item onClick={() => onChange({ ...v, ltgt: 'gt' })}>&gt; {t('More than')}</Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
              <Form.Control
                type="number"
                size="sm"
                style={{ width: 60 }}
                value={v.percent ?? 0}
                onChange={(e) => onChange({ ...v, percent: parseFloat(e.target.value) || 0 })}
              />
              <span>{t('% of my')}</span>
              <Dropdown>
                <Dropdown.Toggle size="sm" variant="primary" id={`bal-aa-${name}`}>
                  {t(v.allactive === 'all' ? 'Total' : 'Active')}
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  <Dropdown.Item onClick={() => onChange({ ...v, allactive: 'active' })}>{t('Active Portfolio')}</Dropdown.Item>
                  <Dropdown.Item onClick={() => onChange({ ...v, allactive: 'all' })}>{t('Total Portfolio')}</Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            </div>

            <div className="mt-2">
              {loading ? <Alert variant="info" className="py-1">{t('Loading data from Kiva…')}</Alert> : null}
              {!loading ? (
                <div>
                  <span style={{ fontSize: 13 }}>
                    {t('Matching: {count}. Loans from these {category} will be {visibility}.', {
                      count: slices.length,
                      category: t(meta.label).toLocaleLowerCase(),
                      visibility: t(v.hideshow === 'show' ? 'shown' : 'hidden'),
                    })}
                  </span>
                  {slices.length > 0 ? (
                    <ul style={{ overflowY: 'auto', maxHeight: 200, fontSize: 12, marginTop: 4 }}>
                      {slices.map((slice, i) => (
                        <li key={i}>
                          {numeral(slice.percent).format('0.000')}%:{' '}
                          {meta.sliceBy === 'sector' && slice.name ? sector(slice.name) : slice.name}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {lastUpdated ? (
                    <p style={{ fontSize: 11, color: '#999' }}>
                      {t('Last updated {time}', { time: date(Number(lastUpdated) * 1000) })}
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
  const { locale, sector } = useI18n()
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
      // Keep the English `value` as filter authority; localize only the label.
      sector: mergeByValue(serverOptions.sectors ?? [], SECTOR_OPTIONS, discovered(sectors))
        .map((option) => ({ ...option, label: sector(option.value) }))
        .sort((a, b) => a.label.localeCompare(b.label, locale)),
      activity: mergeByValue(serverOptions.activities ?? [], ACTIVITY_OPTIONS, discovered(activities)),
      themes: mergeByValue(serverOptions.themes ?? [], THEME_OPTIONS, discovered(themes)),
      tags: mergeByValue(serverOptions.tags ?? [], TAG_OPTIONS, discovered(tags)),
    }
    // loanCount/serverOptions are the triggers; loans are read imperatively.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loanCount, serverOptions, locale, sector])
}

// ---------------------------------------------------------------------------
// Sub-component: LoanCriteriaPanel
// ---------------------------------------------------------------------------

function LoanCriteriaPanel({
  criteria,
  onUpdate,
  onInspectSelect,
  onInspectEnd,
  distribution,
  distributionKey,
  sortMode,
  onSortMode,
}: {
  criteria: Criteria
  onUpdate: (group: 'loan' | 'partner' | 'portfolio', key: string, value: unknown) => void
  onInspectSelect: (group: 'loan' | 'partner', key: string, canAll?: boolean, top?: number) => void
  onInspectEnd: () => void
  distribution?: Record<string, number>
  distributionKey?: string
  sortMode?: 'abc' | 'count'
  onSortMode?: (mode: 'abc' | 'count') => void
}) {
  const { t, locale } = useI18n()
  const loan = criteria.loan as Record<string, unknown>
  const discovered = useDiscoveredOptions()

  const loanSelects: Array<{
    key: string; label: string; options: SelectOption[]; isMulti: boolean
    hasAan?: boolean; canAll?: boolean; helpText?: string; showDistribution?: boolean
  }> = [
    { key: 'country_code', label: t('Countries'), options: COUNTRY_OPTIONS, isMulti: true, hasAan: true, showDistribution: true },
    { key: 'sector', label: t('Sectors'), options: discovered.sector, isMulti: true, hasAan: true, showDistribution: true },
    { key: 'activity', label: t('Activities'), options: discovered.activity, isMulti: true, hasAan: true, showDistribution: true },
    { key: 'themes', label: t('Themes'), options: discovered.themes, isMulti: true, hasAan: true, canAll: true, showDistribution: true },
    { key: 'tags', label: t('Tags'), options: discovered.tags, isMulti: true, hasAan: true, canAll: true, showDistribution: true },
    { key: 'repayment_interval', label: t('Repayment Interval'), options: REPAYMENT_INTERVAL_OPTIONS, isMulti: true, showDistribution: true },
    { key: 'currency_exchange_loss_liability', label: t('Currency Loss'), options: CURRENCY_LOSS_OPTIONS, isMulti: true, showDistribution: true },
    { key: 'bonus_credit_eligibility', label: t('Bonus Credit'), options: BONUS_CREDIT_OPTIONS, isMulti: false, showDistribution: true },
    { key: 'sort', label: t('Sort'), options: SORT_OPTIONS, isMulti: false },
  ]

  return (
    <>
      <InputRow
        label={t('Use or Description')}
        value={String(loan['use'] ?? '')}
        onChange={(val) => onUpdate('loan', 'use', val)}
        placeholder={locale !== 'en' ? t('Search in English') : undefined}
      />
      <InputRow
        label={t('Name')}
        value={String(loan['name'] ?? '')}
        onChange={(val) => onUpdate('loan', 'name', val)}
      />

      {loanSelects.map((sel) => (
        <SelectRow
          key={sel.key}
          fieldKey={sel.key}
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
          distribution={sel.showDistribution && distributionKey === sel.key ? distribution : undefined}
          sortMode={sortMode}
          onSortMode={onSortMode}
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
  distribution,
  distributionKey,
  sortMode,
  onSortMode,
}: {
  criteria: Criteria
  onUpdate: (group: 'loan' | 'partner' | 'portfolio', key: string, value: unknown) => void
  onInspectSelect: (group: 'loan' | 'partner', key: string, canAll?: boolean, top?: number) => void
  onInspectEnd: () => void
  distribution?: Record<string, number>
  distributionKey?: string
  sortMode?: 'abc' | 'count'
  onSortMode?: (mode: 'abc' | 'count') => void
}) {
  const partner = criteria.partner as Record<string, unknown>
  const partnerOptions = usePartnerOptions()

  const partnerSelects: Array<{
    key: string; label: string; options: SelectOption[]; isMulti: boolean
    hasAan?: boolean; canAll?: boolean; helpText?: string; showDistribution?: boolean
  }> = [
    { key: 'direct', label: 'MFI or Direct', options: DIRECT_OPTIONS, isMulti: false, showDistribution: true,
      helpText: 'Most Kiva loans go through a field partner (an MFI). “Direct” loans are made straight to the borrower with no MFI. The default “MFI Only” hides Direct loans — that’s why the loans shown can be fewer than the total fundraising count.' },
    { key: 'partners', label: 'Field Partner', options: partnerOptions, isMulti: true, hasAan: true,
      helpText: 'Pick specific field partners (MFIs). Use the Any/None toggle to require loans from any of the selected partners, or to exclude them. Only applies in MFI mode.' },
    { key: 'region', label: 'Region', options: REGION_OPTIONS, isMulti: true, hasAan: true, showDistribution: true },
    { key: 'social_performance', label: 'Social Performance', options: SOCIAL_PERFORMANCE_OPTIONS, isMulti: true, hasAan: true, canAll: true, showDistribution: true },
    { key: 'charges_fees_and_interest', label: 'Charges Interest', options: CHARGES_INTEREST_OPTIONS, isMulti: false, showDistribution: true },
    { key: 'religion', label: 'Religion', options: RELIGION_OPTIONS, isMulti: true, hasAan: true, showDistribution: true,
      helpText: RELIGION_HELP },
  ]

  return (
    <>
      {partnerSelects.map((sel) => (
        <SelectRow
          key={sel.key}
          fieldKey={sel.key}
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
          distribution={sel.showDistribution && distributionKey === sel.key ? distribution : undefined}
          sortMode={sortMode}
          onSortMode={onSortMode}
        />
      ))}

      {Object.entries(PARTNER_SLIDERS)
        // The A+ secular/social sliders only filter once A+ data is merged; hide
        // them otherwise (matches the standalone Partners page).
        .filter(
          ([key]) =>
            !!getKivaLoans()?.atheistListProcessed ||
            (key !== 'secular_rating' && key !== 'social_rating'),
        )
        .map(([key, config]) => (
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
  const { t } = useI18n()
  const portfolio = criteria.portfolio as Record<string, unknown>
  const lenderId = useUtilsStore((s) => s.lenderId)

  return (
    <>
      {!lenderId && (
        <Alert variant="warning" className="py-2" style={{ fontSize: 13 }}>
          <a
            href="#"
            className="alert-link"
            onClick={(e) => {
              e.preventDefault()
              showLenderIDModal()
            }}
          >
            {t('Set your Lender ID')}
          </a>{' '}
          {t("to use these. Without it, KivaLens doesn't know which loans you've funded, so “Exclude My Loans” and Portfolio Balancing have no effect.")}
        </Alert>
      )}
      <SelectRow
        label={t('Exclude My Loans')}
        options={EXCLUDE_PORTFOLIO_OPTIONS}
        isMulti={false}
        value={portfolio['exclude_portfolio_loans']}
        onChange={(val) => onUpdate('portfolio', 'exclude_portfolio_loans', val)}
      />

      <Card className="mt-3">
        <Card.Header>{t('Portfolio Balancing')}</Card.Header>
        <Card.Body>
          <p style={{ fontSize: 13 }}>{t('Balance your lending across partners, countries, sectors, and activities. Diversify to reduce risk or find new areas to lend in.')}</p>

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
  const { t } = useI18n()
  const prepForRSS = useCriteriaStore((s) => s.prepForRSS)
  const lenderId = useUtilsStore((s) => s.lenderId)
  const [rssName, setRssName] = useState('')
  const [rssLinkTo, setRssLinkTo] = useState('kiva')
  const [includePortfolio, setIncludePortfolio] = useState(false)

  const critRSS = useMemo(() => {
    const feed: Record<string, unknown> = { name: rssName, link_to: rssLinkTo }
    const base: Record<string, unknown> = { feed, ...prepForRSS(criteria) }
    // The server can now apply portfolio features (balancing + excluding loans
    // you've funded) using your lender id, which it rides in feed.lender_id.
    if (includePortfolio && lenderId) {
      feed.lender_id = lenderId
      if (criteria.portfolio && Object.keys(criteria.portfolio).length > 0) {
        base.portfolio = { ...criteria.portfolio }
      }
    }
    return base
  }, [criteria, prepForRSS, rssName, rssLinkTo, includePortfolio, lenderId])
  const critRSSUrl = encodeURIComponent(JSON.stringify(critRSS))

  return (
    <Row className="ample-padding-top">
      <Col lg={12}>
        <p>
          {t('An RSS feed lets you follow matching loans in a feed reader, browser extension, or an automation service such as')}{' '}
          <NewTabLink href="http://www.ifttt.com">IFTTT (If This Then That)</NewTabLink>.{' '}
          {t('You can create as many feeds as you want and use new feed items to trigger email, SMS, smart-home, and other actions.')}{' '}
          <NewTabLink href="https://ifttt.com/recipes/147561-rss-feed-to-email">
            {t('Create an IFTTT recipe to email you when loans match your criteria')}
          </NewTabLink>.
        </p>
        <p>
          {t('The feed shows the first 100 matching loans. Portfolio features are supported when you set your Kiva Lender ID and enable “Include my portfolio” below.')}
        </p>
        <Card>
          <Card.Header>{t('RSS Feed Details')}</Card.Header>
          <Card.Body>
            <Form.Group>
              <Form.Label>{t('Name (this will appear in your RSS feed reader)')}</Form.Label>
              <Form.Control
                type="text"
                style={{ height: 38, minWidth: 50 }}
                value={rssName}
                onChange={(e) => setRssName(e.target.value)}
              />
            </Form.Group>
            <Form.Group>
              <Form.Label>{t('Links in RSS go to')}</Form.Label>
              <Form.Select value={rssLinkTo} onChange={(e) => setRssLinkTo(e.target.value)}>
                <option value="kiva">Kiva</option>
                <option value="kivalens">KivaLens</option>
              </Form.Select>
            </Form.Group>
            <Form.Group className="mt-2">
              <Form.Check
                type="checkbox"
                id="rss-include-portfolio"
                label={t("Include my portfolio (balancing + exclude loans I've already funded)")}
                checked={includePortfolio && !!lenderId}
                disabled={!lenderId}
                onChange={(e) => setIncludePortfolio(e.target.checked)}
              />
              {!lenderId && (
                <Form.Text className="text-muted">
                  {t('Set your Kiva Lender ID to enable portfolio-aware feeds.')}
                </Form.Text>
              )}
            </Form.Group>
          </Card.Body>
        </Card>
        <Card>
          <Card.Header>{t('Your Settings')}</Card.Header>
          <Card.Body>
            <p>
              {t('These are the criteria options that will be used to generate your feed.')}
              {includePortfolio && lenderId
                ? ` ${t('Your portfolio settings are included.')}`
                : ` ${t('Anything related to your portfolio has been removed.')}`}
            </p>
            <pre>{JSON.stringify(critRSS, null, 2)}</pre>
          </Card.Body>
        </Card>
        <Card>
          <Card.Header>{t('RSS Link')}</Card.Header>
          <Card.Body>
            <p>
              {t('Copy this entire URL into your RSS reader, or use')}{' '}
              <NewTabLink href="http://www.ifttt.com">IFTTT</NewTabLink>{' '}
              {t('to trigger an email, SMS, or another action when a matching loan appears.')}
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
  const { t, sector } = useI18n()
  const lastKnown = useCriteriaStore((s) => s.lastKnown)
  const setCriteria = useCriteriaStore((s) => s.setCriteria)
  const filteredLoans = useLoanStore((s) => s.filteredLoans)
  const sortMode = useUtilsStore((s) => s.criteriaSortMode)
  const setSortMode = useUtilsStore((s) => s.setCriteriaSortMode)

  // Local copy of criteria for debounced editing
  const [criteria, setCriteriaLocal] = useState<Criteria>(() => ({
    loan: { ...lastKnown.loan },
    partner: { ...lastKnown.partner },
    portfolio: { ...lastKnown.portfolio },
  }))

  const [activeTab, setActiveTab] = useState<string>('borrower')
  const [helperTarget, setHelperTarget] = useState<HelperChartTarget | null>(null)
  const [helperChart, setHelperChart] = useState<HelperChart | null>(null)
  const removeGraphTimer = useRef(0)
  // react-select refocuses its input after closing the menu on an outside
  // click; suppress that follow-up onFocus so it can't re-arm the graph.
  const suppressInspectUntil = useRef(0)
  const hideGraphs = !!lsj.get<{ hide_criteria_graphs?: boolean }>('Options').hide_criteria_graphs

  // The AI assistant can switch which criteria tab is shown.
  const aiCriteriaTab = useUtilsStore((s) => s.aiCriteriaTab)
  useEffect(() => {
    if (aiCriteriaTab?.tab) setActiveTab(aiCriteriaTab.tab)
  }, [aiCriteriaTab])

  // The exact criteria object the debounce below last pushed to the store. Lets
  // the sync-from-store effect distinguish our own echo from a genuine external
  // change (declared here so that effect can read it).
  const lastPushedRef = useRef<Criteria | null>(null)

  // Sync from store when criteria is reloaded externally (saved search load, reset)
  const prevLastKnownRef = useRef(lastKnown)
  useEffect(() => {
    if (lastKnown === prevLastKnownRef.current) return
    prevLastKnownRef.current = lastKnown
    // Ignore the echo of our own debounced push: setCriteria set lastKnown to the
    // very object we sent, so there is nothing external to sync and rebuilding
    // local state here would only spin the loop.
    if (lastKnown === lastPushedRef.current) return
    setCriteriaLocal({
      loan: { ...lastKnown.loan },
      partner: { ...lastKnown.partner },
      portfolio: { ...lastKnown.portfolio },
    })
  }, [lastKnown])

  // Debounced push to store triggers loan filtering.
  // Track the exact object we push so the sync-from-store effect below can tell
  // "this lastKnown change is our own write" from a genuine external change
  // (saved-search load, AI apply_criteria, reset). Without this, the push set
  // lastKnown to a new ref, the sync effect saw a new ref and rebuilt local
  // criteria into yet another new ref, which re-armed this debounce — an
  // endless idle setCriteria<->setCriteriaLocal loop that re-rendered the whole
  // panel ~3x/sec and rewrote both persist stores forever.
  useDebouncedEffect(
    () => {
      lastPushedRef.current = criteria
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
    (group: 'loan' | 'partner', key: string, canAll = false) => {
      if (hideGraphs) return
      if (Date.now() < suppressInspectUntil.current) return
      window.clearTimeout(removeGraphTimer.current)
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

    setHelperChart(buildHelperChart(loans, helperTarget.key, sector, t))
  }, [criteria, filteredLoans, helperTarget, hideGraphs, sector, t])

  // The focused field's distribution, fed INTO its own dropdown as in-list bars.
  const distributionMap = useMemo<Record<string, number> | undefined>(() => {
    if (!helperChart) return undefined
    const m: Record<string, number> = {}
    for (const d of helperChart.data) m[d.name] = d.count
    return m
  }, [helperChart])

  return (
    <div data-aikl="criteria-tabs">
      <Tabs
        activeKey={activeTab}
        onSelect={(k) => {
          setActiveTab(k ?? 'borrower')
          setHelperTarget(null)
          setHelperChart(null)
        }}
        className="mb-2"
      >
        <Tab eventKey="borrower" title={t('Borrower')}>
          <div className="pt-2">
            <LoanCriteriaPanel
              criteria={criteria}
              onUpdate={handleUpdate}
              onInspectSelect={handleInspectSelect}
              onInspectEnd={handleInspectEnd}
              distribution={distributionMap}
              distributionKey={helperTarget?.key}
              sortMode={sortMode}
              onSortMode={setSortMode}
            />
          </div>
        </Tab>

        <Tab eventKey="partner" title={t('Partner')}>
          <div className="pt-2">
            <PartnerCriteriaPanel
              criteria={criteria}
              onUpdate={handleUpdate}
              onInspectSelect={handleInspectSelect}
              onInspectEnd={handleInspectEnd}
              distribution={distributionMap}
              distributionKey={helperTarget?.key}
              sortMode={sortMode}
              onSortMode={setSortMode}
            />
          </div>
        </Tab>

        <Tab eventKey="portfolio" title={t('Your Portfolio')}>
          <div className="pt-2">
            <PortfolioCriteriaPanel criteria={criteria} onUpdate={handleUpdate} />
          </div>
        </Tab>

        <Tab eventKey="rss" title={t('RSS')}>
          <div className="pt-2">
            <RSSPanel criteria={criteria} />
          </div>
        </Tab>
      </Tabs>
    </div>
  )
}

export default CriteriaTabs
