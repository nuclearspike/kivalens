/**
 * The fixed choices the search criteria offer, each a stored value and the
 * catalog key of its label. One copy, read by the criteria tabs, the Partners
 * page's filters and the criteria history's descriptions, so a label or a choice
 * cannot differ between them. (A second copy on the Partners page had already
 * drifted: it lacked Uzbekistan.)
 */

export interface SelectOption {
  value: string
  label: string
}

export const COUNTRY_OPTIONS: SelectOption[] = [
  { value: 'AF', label: 'afghanistan' }, { value: 'AL', label: 'albania' }, { value: 'AM', label: 'armenia' },
  { value: 'AZ', label: 'azerbaijan' }, { value: 'BJ', label: 'benin' }, { value: 'BO', label: 'bolivia' },
  { value: 'BA', label: 'bosnia_herzegovina' }, { value: 'BR', label: 'brazil' },
  { value: 'BF', label: 'burkina_faso' }, { value: 'BI', label: 'burundi' }, { value: 'KH', label: 'cambodia' },
  { value: 'CM', label: 'cameroon' }, { value: 'TD', label: 'chad' }, { value: 'CL', label: 'chile' },
  { value: 'CN', label: 'china' }, { value: 'CO', label: 'colombia' }, { value: 'CG', label: 'congo' },
  { value: 'CD', label: 'congo_dem_rep' }, { value: 'CR', label: 'costa_rica' },
  { value: 'CI', label: 'cote_divoire' }, { value: 'DO', label: 'dominican_republic' },
  { value: 'EC', label: 'ecuador' }, { value: 'EG', label: 'egypt' }, { value: 'SV', label: 'el_salvador' },
  { value: 'GE', label: 'georgia' }, { value: 'GH', label: 'ghana' }, { value: 'GT', label: 'guatemala' },
  { value: 'GN', label: 'guinea' }, { value: 'HT', label: 'haiti' }, { value: 'HN', label: 'honduras' },
  { value: 'IN', label: 'india' }, { value: 'ID', label: 'indonesia' }, { value: 'IQ', label: 'iraq' },
  { value: 'IL', label: 'israel' }, { value: 'JO', label: 'jordan' }, { value: 'KE', label: 'kenya' },
  { value: 'XK', label: 'kosovo' }, { value: 'KG', label: 'kyrgyzstan' }, { value: 'LA', label: 'laos' },
  { value: 'LB', label: 'lebanon' }, { value: 'LR', label: 'liberia' }, { value: 'MG', label: 'madagascar' },
  { value: 'MW', label: 'malawi' }, { value: 'ML', label: 'mali' }, { value: 'MX', label: 'mexico' },
  { value: 'MD', label: 'moldova' }, { value: 'MN', label: 'mongolia' }, { value: 'MZ', label: 'mozambique' },
  { value: 'MM', label: 'myanmar_burma' }, { value: 'NA', label: 'namibia' }, { value: 'NP', label: 'nepal' },
  { value: 'NI', label: 'nicaragua' }, { value: 'NE', label: 'niger' }, { value: 'NG', label: 'nigeria' },
  { value: 'PK', label: 'pakistan' }, { value: 'PS', label: 'palestine' }, { value: 'PA', label: 'panama' },
  { value: 'PG', label: 'papua_new_guinea' }, { value: 'PY', label: 'paraguay' }, { value: 'PE', label: 'peru' },
  { value: 'PH', label: 'philippines' }, { value: 'PR', label: 'puerto_rico' }, { value: 'RW', label: 'rwanda' },
  { value: 'WS', label: 'samoa' }, { value: 'SN', label: 'senegal' }, { value: 'SL', label: 'sierra_leone' },
  { value: 'SB', label: 'solomon_islands' }, { value: 'SO', label: 'somalia' },
  { value: 'ZA', label: 'south_africa' }, { value: 'SS', label: 'south_sudan' },
  { value: 'LK', label: 'sri_lanka' }, { value: 'SR', label: 'suriname' }, { value: 'TJ', label: 'tajikistan' },
  { value: 'TZ', label: 'tanzania' }, { value: 'TH', label: 'thailand' },
  { value: 'TL', label: 'timor_leste' }, { value: 'TG', label: 'togo' }, { value: 'TO', label: 'tonga' },
  { value: 'TR', label: 'turkey' }, { value: 'UG', label: 'uganda' }, { value: 'UA', label: 'ukraine' },
  { value: 'US', label: 'united_states' }, { value: 'UZ', label: 'uzbekistan' }, { value: 'VN', label: 'vietnam' },
  { value: 'VU', label: 'vanuatu' }, { value: 'YE', label: 'yemen' }, { value: 'ZM', label: 'zambia' },
  { value: 'ZW', label: 'zimbabwe' },
]

export const SECTOR_OPTIONS: SelectOption[] = [
  { value: 'Agriculture', label: 'agriculture' }, { value: 'Arts', label: 'arts' }, { value: 'Clean Energy', label: 'clean_energy' },
  { value: 'Clothing', label: 'clothing' }, { value: 'Construction', label: 'construction' }, { value: 'Education', label: 'education' },
  { value: 'Entertainment', label: 'entertainment' }, { value: 'Food', label: 'food' }, { value: 'Health', label: 'health' },
  { value: 'Housing', label: 'housing' }, { value: 'Manufacturing', label: 'manufacturing' }, { value: 'Personal Use', label: 'personal_use' },
  { value: 'Retail', label: 'retail' }, { value: 'Reuse & Recycle', label: 'reuse_recycle' }, { value: 'Sanitation & Hygiene', label: 'sanitation_hygiene' },
  { value: 'Services', label: 'services' }, { value: 'Transportation', label: 'transportation' }, { value: 'Water', label: 'water' },
  { value: 'Wholesale', label: 'wholesale' },
]

// Kiva's full activity taxonomy (from the original app)
export const ACTIVITY_OPTIONS: SelectOption[] = [
  { value: 'Agriculture', label: 'agriculture' }, { value: 'Air Conditioning', label: 'air_conditioning' },
  { value: 'Animal Sales', label: 'animal_sales' }, { value: 'Aquaculture', label: 'aquaculture' },
  { value: 'Arts', label: 'arts' }, { value: 'Auto Repair', label: 'auto_repair' }, { value: 'Bakery', label: 'bakery' },
  { value: 'Balut-Making', label: 'balut_making' }, { value: 'Barber Shop', label: 'barber_shop' },
  { value: 'Beauty Salon', label: 'beauty_salon' }, { value: 'Beverages', label: 'beverages' }, { value: 'Bicycle Repair', label: 'bicycle_repair' },
  { value: 'Bicycle Sales', label: 'bicycle_sales' }, { value: 'Blacksmith', label: 'blacksmith' },
  { value: 'Bookbinding', label: 'bookbinding' }, { value: 'Bookstore', label: 'bookstore' }, { value: 'Bricks', label: 'bricks' },
  { value: 'Butcher Shop', label: 'butcher_shop' }, { value: 'Cafe', label: 'cafe' }, { value: 'Call Center', label: 'call_center' },
  { value: 'Carpentry', label: 'carpentry' }, { value: 'Catering', label: 'catering' }, { value: 'Cattle', label: 'cattle' },
  { value: 'Cement', label: 'cement' }, { value: 'Cereals', label: 'cereals' }, { value: 'Charcoal Sales', label: 'charcoal_sales' },
  { value: 'Cheese Making', label: 'cheese_making' }, { value: 'Child Care', label: 'child_care' },
  { value: 'Cleaning Services', label: 'cleaning_services' }, { value: 'Cloth & Dressmaking Supplies', label: 'cloth_dressmaking_supplies' },
  { value: 'Clothing', label: 'clothing' }, { value: 'Clothing Sales', label: 'clothing_sales' }, { value: 'Cobbler', label: 'cobbler' },
  { value: 'Communications', label: 'communications' }, { value: 'Community Water Distribution', label: 'community_water_distribution' },
  { value: 'Computer', label: 'computer' }, { value: 'Computers', label: 'computers' }, { value: 'Construction', label: 'construction' },
  { value: 'Construction Supplies', label: 'construction_supplies' }, { value: 'Consumer Goods', label: 'consumer_goods' },
  { value: 'Cosmetics Sales', label: 'cosmetics_sales' }, { value: 'Crafts', label: 'crafts' }, { value: 'Dairy', label: 'dairy' },
  { value: 'Day Care/Adult Care', label: 'day_care_adult_care' }, { value: 'Decorations Sales', label: 'decorations_sales' },
  { value: 'Dental', label: 'dental' }, { value: 'Education provider', label: 'education_provider' },
  { value: 'Electrical Goods', label: 'electrical_goods' }, { value: 'Electrician', label: 'electrician' },
  { value: 'Electronics Repair', label: 'electronics_repair' }, { value: 'Electronics Sales', label: 'electronics_sales' },
  { value: 'Embroidery', label: 'embroidery' }, { value: 'Energy', label: 'energy' }, { value: 'Entertainment', label: 'entertainment' },
  { value: 'Event Planning', label: 'event_planning' }, { value: 'Farm Supplies', label: 'farm_supplies' },
  { value: 'Farming', label: 'farming' }, { value: 'Film', label: 'film' }, { value: 'Fish Selling', label: 'fish_selling' },
  { value: 'Fishing', label: 'fishing' }, { value: 'Florist', label: 'florist' }, { value: 'Flowers', label: 'flowers' },
  { value: 'Food', label: 'food' }, { value: 'Food Market', label: 'food_market' }, { value: 'Food Production/Sales', label: 'food_production_sales' },
  { value: 'Food Stall', label: 'food_stall' }, { value: 'Fruits & Vegetables', label: 'fruits_vegetables' },
  { value: 'Fuel/Firewood', label: 'fuel_firewood' }, { value: 'Funeral Expenses', label: 'funeral_expenses' },
  { value: 'Furniture Making', label: 'furniture_making' }, { value: 'Games', label: 'games' }, { value: 'General Store', label: 'general_store' },
  { value: 'Goods Distribution', label: 'goods_distribution' }, { value: 'Grocery Store', label: 'grocery_store' },
  { value: 'Hardware', label: 'hardware' }, { value: 'Health', label: 'health' }, { value: 'Higher education costs', label: 'higher_education_costs' },
  { value: 'Home Appliances', label: 'home_appliances' }, { value: 'Home Energy', label: 'home_energy' },
  { value: 'Home Products Sales', label: 'home_products_sales' }, { value: 'Hotel', label: 'hotel' },
  { value: 'Internet Cafe', label: 'internet_cafe' }, { value: 'Jewelry', label: 'jewelry' }, { value: 'Knitting', label: 'knitting' },
  { value: 'Land Rental', label: 'land_rental' }, { value: 'Landscaping / Gardening', label: 'landscaping_gardening' },
  { value: 'Landscaping/Gardening', label: 'landscaping_gardening_2' }, { value: 'Laundry', label: 'laundry' },
  { value: 'Liquor Store / Off-License', label: 'liquor_store_off_license' }, { value: 'Livestock', label: 'livestock' },
  { value: 'Machine Shop', label: 'machine_shop' }, { value: 'Machinery Rental', label: 'machinery_rental' },
  { value: 'Manufacturing', label: 'manufacturing' }, { value: 'Medical Clinic', label: 'medical_clinic' },
  { value: 'Metal Shop', label: 'metal_shop' }, { value: 'Milk Sales', label: 'milk_sales' }, { value: 'Mobile Phones', label: 'mobile_phones' },
  { value: 'Mobile Transactions', label: 'mobile_transactions' }, { value: 'Motorcycle Repair', label: 'motorcycle_repair' },
  { value: 'Motorcycle Transport', label: 'motorcycle_transport' }, { value: 'Movie Tapes & DVDs', label: 'movie_tapes_dvds' },
  { value: 'Music Discs & Tapes', label: 'music_discs_tapes' }, { value: 'Musical Instruments', label: 'musical_instruments' },
  { value: 'Musical Performance', label: 'musical_performance' }, { value: 'Natural Medicines', label: 'natural_medicines' },
  { value: 'Office Supplies', label: 'office_supplies' }, { value: 'Other', label: 'other' }, { value: 'Paper Sales', label: 'paper_sales' },
  { value: 'Party Supplies', label: 'party_supplies' }, { value: 'Patchwork', label: 'patchwork' },
  { value: 'Perfumes', label: 'perfumes' }, { value: 'Personal Expenses', label: 'personal_expenses' },
  { value: 'Personal Housing Expenses', label: 'personal_housing_expenses' }, { value: 'Personal Medical Expenses', label: 'personal_medical_expenses' },
  { value: 'Personal Products Sales', label: 'personal_products_sales' }, { value: 'Personal Purchases', label: 'personal_purchases' },
  { value: 'Pharmacy', label: 'pharmacy' }, { value: 'Phone Accessories', label: 'phone_accessories' },
  { value: 'Phone Repair', label: 'phone_repair' }, { value: 'Phone Use Sales', label: 'phone_use_sales' },
  { value: 'Photography', label: 'photography' }, { value: 'Pigs', label: 'pigs' }, { value: 'Plastics Sales', label: 'plastics_sales' },
  { value: 'Poultry', label: 'poultry' }, { value: 'Primary/secondary school costs', label: 'primary_secondary_school_costs' },
  { value: 'Printing', label: 'printing' }, { value: 'Property', label: 'property' }, { value: 'Pub', label: 'pub' },
  { value: 'Quarrying', label: 'quarrying' }, { value: 'Recycled Materials', label: 'recycled_materials' },
  { value: 'Recycling', label: 'recycling' }, { value: 'Religious Articles', label: 'religious_articles' },
  { value: 'Renewable Energy Products', label: 'renewable_energy_products' }, { value: 'Repair/Mechanic', label: 'repair_mechanic' },
  { value: 'Restaurant', label: 'restaurant' }, { value: 'Restaurant/Caterer', label: 'restaurant_caterer' },
  { value: 'Retail', label: 'retail' }, { value: 'Rickshaw', label: 'rickshaw' }, { value: 'Secretarial Services', label: 'secretarial_services' },
  { value: 'Services', label: 'services' }, { value: 'Sewing', label: 'sewing' }, { value: 'Shoe Sales', label: 'shoe_sales' },
  { value: 'Social Enterprise', label: 'social_enterprise' }, { value: 'Soft Drinks', label: 'soft_drinks' },
  { value: 'Solar Home Systems', label: 'solar_home_systems' }, { value: 'Souvenir Sales', label: 'souvenir_sales' },
  { value: 'Spare Parts', label: 'spare_parts' }, { value: 'Sporting Good Sales', label: 'sporting_good_sales' },
  { value: 'Tailoring', label: 'tailoring' }, { value: 'Taxi', label: 'taxi' }, { value: 'Textiles', label: 'textiles' },
  { value: 'Timber Sales', label: 'timber_sales' }, { value: 'Toilets & Sanitation Systems', label: 'toilets_sanitation_systems' },
  { value: 'Tourism', label: 'tourism' }, { value: 'Transportation', label: 'transportation' }, { value: 'Traveling Sales', label: 'traveling_sales' },
  { value: 'Upholstery', label: 'upholstery' }, { value: 'Used Clothing', label: 'used_clothing' },
  { value: 'Used Shoes', label: 'used_shoes' }, { value: 'Utilities', label: 'utilities' }, { value: 'Vehicle', label: 'vehicle' },
  { value: 'Vehicle Repairs', label: 'vehicle_repairs' }, { value: 'Veterinary Sales', label: 'veterinary_sales' },
  { value: 'Waste Management', label: 'waste_management' }, { value: 'Water Distribution', label: 'water_distribution' },
  { value: 'Water Pumps & Irrigation', label: 'water_pumps_irrigation' }, { value: 'Weaving', label: 'weaving' },
  { value: 'Wedding Expenses', label: 'wedding_expenses' }, { value: 'Well digging', label: 'well_digging' },
  { value: 'Wholesale', label: 'wholesale' },
]

export const TAG_OPTIONS: SelectOption[] = [
  { value: 'user_favorite', label: 'user_favorite' },
  { value: 'volunteer_like', label: 'volunteer_like' },
  { value: 'volunteer_pick', label: 'volunteer_pick' },
  { value: '#Animals', label: 'animals' },
  { value: '#BizDurableAsset', label: 'bizdurableasset' },
  { value: '#Eco-friendly', label: 'eco_friendly' },
  { value: '#Elderly', label: 'elderly' },
  { value: '#Fabrics', label: 'fabrics' },
  { value: '#FemaleEducation', label: 'femaleeducation' },
  { value: '#FirstLoan', label: 'firstloan' },
  { value: '#HealthandSanitation', label: 'healthandsanitation' },
  { value: '#JobCreator', label: 'jobcreator' },
  { value: '#Orphan', label: 'orphan' },
  { value: '#Parent', label: 'parent' },
  { value: '#Refugee', label: 'refugee' },
  { value: '#RepairRenewReplace', label: 'repairrenewreplace' },
  { value: '#RepeatBorrower', label: 'repeatborrower' },
  { value: '#Schooling', label: 'schooling' },
  { value: '#Single', label: 'single' },
  { value: '#SingleParent', label: 'singleparent' },
  { value: '#SupportingFamily', label: 'supportingfamily' },
  { value: '#SustainableAg', label: 'sustainableag' },
  { value: '#Technology', label: 'technology' },
  { value: '#Trees', label: 'trees' },
  { value: '#Vegan', label: 'vegan' },
  { value: '#Widowed', label: 'widowed' },
  { value: '#WomanOwnedBiz', label: 'womanownedbiz' },
  { value: '#BIPOC-ownedBusiness', label: 'bipoc_ownedbusiness' },
  { value: '#COVID-19', label: 'covid_19' },
  { value: '#CommunityImpact', label: 'communityimpact' },
  { value: '#InspiringStory', label: 'inspiringstory' },
  { value: '#Latinx/Hispanic-OwnedBusiness', label: 'latinx_hispanic_ownedbusiness' },
  { value: '#NewBusiness', label: 'newbusiness' },
  { value: '#PowerfulStory', label: 'powerfulstory' },
  { value: '#StandoutBackstory', label: 'standoutbackstory' },
  { value: '#TangibleProducts', label: 'tangibleproducts' },
  { value: '#USBlack-OwnedBusiness', label: 'usblack_ownedbusiness' },
  { value: '#USEtsy', label: 'usetsy' },
  { value: '#USPGE', label: 'uspge' },
  { value: '#USimmigrant', label: 'usimmigrant' },
  { value: '#Unique', label: 'unique' },
  { value: '#Woman-OwnedBusiness', label: 'woman_ownedbusiness' },
  { value: 'BNY', label: 'bny' },
  { value: 'USRefugee', label: 'usrefugee' },
]

export const THEME_OPTIONS: SelectOption[] = [
  { value: 'Arab Youth', label: 'arab_youth' }, { value: 'Clean Energy', label: 'clean_energy' }, { value: 'Conflict Zones', label: 'conflict_zones' },
  { value: 'Crop Insurance', label: 'crop_insurance' }, { value: 'Disaster recovery', label: 'disaster_recovery' },
  { value: 'Earth Day Campaign', label: 'earth_day_campaign' }, { value: 'Fair Trade', label: 'fair_trade' },
  { value: 'Green', label: 'green' }, { value: 'Growing Businesses', label: 'growing_businesses' },
  { value: 'Health', label: 'health' }, { value: 'Higher Education', label: 'higher_education' }, { value: 'Innovative Loans', label: 'innovative_loans' },
  { value: 'International COVID-19 support', label: 'international_covid_19_support' }, { value: 'Islamic Finance', label: 'islamic_finance' },
  { value: 'Job Creation', label: 'job_creation' }, { value: 'Mobile Technology', label: 'mobile_technology' },
  { value: 'Refugees/Displaced', label: 'refugees_displaced' }, { value: 'Rural Exclusion', label: 'rural_exclusion' },
  { value: 'SME', label: 'sme' }, { value: 'Social Enterprise', label: 'social_enterprise' }, { value: 'Solar', label: 'solar' },
  { value: 'Start-Up', label: 'start_up' }, { value: 'Underfunded Areas', label: 'underfunded_areas' },
  { value: 'Vulnerable Groups', label: 'vulnerable_groups' }, { value: 'Water and Sanitation', label: 'water_sanitation' },
  { value: 'Youth', label: 'youth' },
]

export const REPAYMENT_INTERVAL_OPTIONS: SelectOption[] = [
  { value: 'Monthly', label: 'monthly' },
  { value: 'Irregularly', label: 'irregularly' },
  { value: 'At end of term', label: 'end_term' },
]

// Kiva's terms.loss_liability.currency_exchange: who carries a loss from exchange rates.
export const CURRENCY_LOSS_OPTIONS: SelectOption[] = [
  { value: 'lender', label: 'lender_covers' },
  { value: 'shared', label: 'shared_loss' },
  { value: 'none', label: 'no_currency_exchange_loss' },
  { value: 'partner', label: 'partner_covers' },
]

export const BONUS_CREDIT_OPTIONS: SelectOption[] = [
  { value: '', label: 'show_all' },
  { value: 'true', label: 'only_loans_eligible' },
  { value: 'false', label: 'only_loans_not_eligible' },
]

export const SORT_OPTIONS: SelectOption[] = [
  { value: '', label: 'final_repayment_date_default' },
  { value: 'half_back', label: 'date_half_paid_back_then' },
  { value: 'newest', label: 'newest' },
  { value: 'expiring', label: 'expiring' },
  { value: 'popularity', label: 'popularity_dollar_hour' },
  { value: 'still_needed', label: 'dollar_still_needed' },
]

// Partner selects
// A loan either has a field partner (MFI) or not (Direct); Both is every loan.
// Partner criteria describe the field partner, so they apply in MFI only — see
// resolvePartnerMode in server/loanFilter.mjs.
export const DIRECT_OPTIONS: SelectOption[] = [
  { value: 'both', label: 'mfi_direct_both' },
  { value: 'mfi', label: 'mfi_only' },
  { value: 'direct', label: 'direct_only' },
]

export const REGION_OPTIONS: SelectOption[] = [
  { value: 'na', label: 'north_america' }, { value: 'ca', label: 'central_america' },
  { value: 'sa', label: 'south_america' }, { value: 'af', label: 'africa' },
  { value: 'as', label: 'asia' }, { value: 'me', label: 'middle_east' },
  { value: 'ee', label: 'eastern_europe' }, { value: 'oc', label: 'oceania' },
  { value: 'we', label: 'western_europe' },
]

export const SOCIAL_PERFORMANCE_OPTIONS: SelectOption[] = [
  { value: '1', label: 'anti_poverty_focus' },
  { value: '3', label: 'client_voice' },
  { value: '5', label: 'entrepreneurial_support' },
  { value: '6', label: 'facilitation_savings' },
  { value: '4', label: 'family_community_empowerment' },
  { value: '7', label: 'innovation' },
  { value: '2', label: 'vulnerable_group_focus' },
]

export const CHARGES_INTEREST_OPTIONS: SelectOption[] = [
  { value: '', label: 'show_all' },
  { value: 'true', label: 'only_partners_charge_fees_interest' },
  { value: 'false', label: 'only_partners_not_charge_fees' },
]

export const RELIGION_OPTIONS: SelectOption[] = [
  { value: 'Secular', label: 'secular' }, { value: 'Christian', label: 'christian' },
  { value: 'Christian Influence', label: 'christian_influence' }, { value: 'Muslim', label: 'muslim' },
  { value: 'Hindu', label: 'hindu' }, { value: 'Jewish', label: 'jewish' },
  { value: 'Buddhist', label: 'buddhist' }, { value: 'Other', label: 'other' },
  { value: 'Unknown', label: 'unknown_2' },
]

export const EXCLUDE_PORTFOLIO_OPTIONS: SelectOption[] = [
  { value: 'true', label: 'yes_exclude_loans_ive_made' },
  { value: 'false', label: 'no_include_loans_ive_made' },
]
