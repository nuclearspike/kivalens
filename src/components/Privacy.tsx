import { Container } from '../ui'
import { Link } from 'react-router-dom'
import { useI18n } from '../i18n'
import { RAW_DAYS } from '../lib/rum/retention'

// Privacy policy. KivaLens is an independent tool (not Kiva); it has no accounts
// of its own. The notable data flow is the "Ask KivaLens" assistant, whose
// conversations are logged for analytics/debugging/improvement.
export default function Privacy() {
  const { t, tx, date } = useI18n()
  return (
    <Container className="py-3" style={{ maxWidth: 820 }}>
      <h1>{t('kivalens_privacy_policy')}</h1>
      <p className="text-muted">{t('last_updated_date', { date: date('2026-09-25T12:00:00Z', { dateStyle: 'long' }) })}</p>

      <h3>{t('about_kivalens')}</h3>
      <p>
        {t('kivalens_free_independent_tool_searching')}
      </p>

      <h3>{t('short_version')}</h3>
      <ul>
        <li>
           {t('preferences_search_criteria_saved')}
        </li>
        <li>
           {t('if_use_ask_kivalens_ai')}
        </li>
        <li>{t('we_not_sell_data_we')}</li>
      </ul>

      <h3>{t('information_we_handle')}</h3>
      <h4>{t('stored_browser')}</h4>
      <p>
        {t('search_criteria_saved_searches_basket')}
      </p>

      <h4>{t('kiva_lender_id_optional')}</h4>
      <p>
        {t('if_provide_kiva_lender_id')}
      </p>

      <h4>{t('ask_kivalens_ai_assistant_conversations')}</h4>
      <p>
        {t('when_chat_assistant_messages_context')}
      </p>
      <p>
        {t('we_log_these_conversations_messages')}
      </p>
      <p>
        {t('not_put_sensitive_personal_information')}
      </p>

      <h4>{t('anonymous_diagnostics')}</h4>
      <p>
        {t('anonymous_visit_reports')}
      </p>
      <p>
        {t('kivalens_may_send_occasional_anonymous')}
      </p>

      <h4>{t('loans_partners_lending')}</h4>
      <p>
        {t('loan_borrower_field_partner_information')}
      </p>

      <h3>{t('third_parties')}</h3>
      <ul>
        <li>
           {t('kiva_api_credit')}
        </li>
        <li>
           {t('openai_powers_ai_assistant_receives')}
        </li>
        <li>
           {t('google_docs_hosts_public_team')}
        </li>
        <li>
           {t('hosting_infrastructure_providers')}
        </li>
      </ul>
      <p>{t('each_third_party_has_its')}</p>

      <h3>{t('cookies_tracking')}</h3>
      <p>
        {t('kivalens_not_use_advertising_cross_site')}
      </p>

      <h3>{t('data_retention')}</h3>
      <p>
        {t('browser_stored_data_persists_until_clear')} {t('visit_reports_retention', { days: RAW_DAYS })}
      </p>

      <h3>{t('choices')}</h3>
      <p>
        {tx('use_most_without_lender_id', { options: <Link to="/options">{t('options')}</Link> })}{' '}
        {t('clearing_browser_storage_removes_local')}
      </p>

      <h3>{t('children')}</h3>
      <p>
        {t('kivalens_not_directed_children_under')}
      </p>

      <h3>{t('changes')}</h3>
      <p>{t('we_may_update_policy_last')}</p>

      <h3>{t('contact')}</h3>
      <p>
        {tx('privacy_questions_see_about', { about: <Link to="/about/advanced">{t('about')}</Link> })}
      </p>
    </Container>
  )
}
