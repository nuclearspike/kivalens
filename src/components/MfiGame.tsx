import { Link } from 'react-router-dom'
import { Button, Container } from '../ui'
import { EnlargeableImage } from '../ui/ImageLightbox'
import { useI18n } from '../i18n'
import { useSupportStore } from '../support/supportStore'
import './MfiGame.scss'

/** Where the game is played. Its own site, so the game's saves and settings stay with it. */
export const GAME_URL = 'https://mfi.kivalens.org/'

/**
 * The MFI Game page: what MFI Builder is, and the way into it. A lender who has
 * only ever chosen loans sees what running the institution behind them involves,
 * and starts in one click. The game's own data, and what it reports, are described
 * on the privacy page (#mfi-game).
 */
export default function MfiGame() {
  const { t, tx } = useI18n()
  return (
    <Container className="py-3 kl-mfi-game">
      <h1>{t('mfi_game_title')}</h1>
      <p className="kl-mfi-game-lead">{t('mfi_game_lead')}</p>
      <div className="kl-mfi-game-start">
        <Button variant="success" size="lg" href={GAME_URL} data-aikl="game-start">
          {t('mfi_game_start')}
        </Button>
        <span className="text-muted">{t('mfi_game_free')}</span>
      </div>

      <div className="kl-mfi-game-shots">
        <EnlargeableImage
          src="/images/mfi-game/district.jpg"
          alt={t('mfi_game_shot_district')}
          caption={t('mfi_game_shot_district')}
          width={1200}
          height={800}
        />
        <EnlargeableImage
          src="/images/mfi-game/branch.jpg"
          alt={t('mfi_game_shot_branch')}
          caption={t('mfi_game_shot_branch')}
          width={1200}
          height={800}
        />
      </div>

      <h3>{t('mfi_game_what_you_do')}</h3>
      <ul>
        <li>{t('mfi_game_do_open')}</li>
        <li>{t('mfi_game_do_lend')}</li>
        <li>{t('mfi_game_do_field')}</li>
        <li>{t('mfi_game_do_grow')}</li>
      </ul>

      <h3>{t('mfi_game_why')}</h3>
      <p>{t('mfi_game_why_body')}</p>
      <p>{t('mfi_game_fiction')}</p>

      <h3>{t('mfi_game_how_to_play')}</h3>
      <p>{t('mfi_game_how_to_play_body')}</p>
      <p>
        {tx('mfi_game_in_progress', {
          feedback: (
            <button type="button" className="kl-link-button" onClick={() => useSupportStore.getState().openFeedback()}>
              {t('send_feedback')}
            </button>
          ),
        })}
      </p>
      <p className="text-muted small">
        {tx('mfi_game_privacy_note', { privacy: <Link to="/privacy#mfi-game">{t('kivalens_privacy_policy')}</Link> })}
      </p>

      <div className="kl-mfi-game-start">
        <Button variant="success" href={GAME_URL}>
          {t('mfi_game_start')}
        </Button>
      </div>
    </Container>
  )
}
