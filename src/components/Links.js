import React from 'react';
import PT from 'prop-types';
import KivaLogo from './KivaImage/KivaLogo';

const trackOutbound = () => {
  // todo: get this old code running the way it should work.
  // e=>rga.outboundLink({label: href},c=>{})
};

export const ClickLink = ({ onClick, title, className, children }) => (
  <a
    href="#"
    className={className}
    title={title}
    onClick={e => {
      e.preventDefault();
      onClick(e);
    }}
  >
    {children}
  </a>
);

ClickLink.propTypes = {
  onClick: PT.func.isRequired,
  title: PT.string,
  className: PT.string,
  children: PT.node.isRequired,
};

export const NewTabLink = ({ href, title, className, children }) => (
  <a
    className={className}
    href={href}
    onClick={trackOutbound}
    rel="noopener noreferrer"
    title={title || 'Open link in new tab'}
    target="_blank"
  >
    {children}
  </a>
);

NewTabLink.propTypes = {
  href: PT.string.isRequired,
  title: PT.string,
  className: PT.string,
  children: PT.node,
};

NewTabLink.defaultProps = {
  title: undefined,
  className: undefined,
  children: undefined,
};

export const KivaLink = ({ path, title, className, children, hideLogo }) => (
  <NewTabLink
    className={className}
    href={`https://www.kiva.org/${path}`}
    title={title || 'Open page on www.kiva.org in new tab'}
  >
    {!hideLogo && <KivaLogo />}
    {children}
  </NewTabLink>
);

KivaLink.propTypes = {
  path: PT.string.isRequired,
  title: PT.string,
  className: PT.string,
  children: PT.node,
  hideLogo: PT.bool,
};

KivaLink.defaultProps = {
  title: undefined,
  className: undefined,
  children: undefined,
  hideLogo: false,
};

export const LenderLink = ({
  lender,
  title,
  className,
  children,
  hideLogo,
}) => (
  <KivaLink
    className={className}
    path={`lender/${lender}?super_graphs=1`}
    title={title || "View Lender's page in a new tab"}
    hideLogo={hideLogo}
  >
    {children}
  </KivaLink>
);

LenderLink.propTypes = {
  lender: PT.string.isRequired,
  title: PT.string,
  className: PT.string,
  children: PT.node,
  hideLogo: PT.bool,
};

LenderLink.defaultProps = {
  title: undefined,
  className: undefined,
  children: undefined,
  hideLogo: false,
};

export const LoanLink = ({
  id,
  title,
  children,
  className,
  loan,
  hideLogo,
}) => {
  if (loan) {
    id = loan.id;
    title = title || `View loan for ${loan.name} on Kiva.org in a new tab`;
    if (!children) {
      children = loan.name;
    }
  }
  return (
    <KivaLink
      className={className}
      path={`lend/${id}`}
      title={title || 'View Loan in a new tab'}
      hideLogo={hideLogo}
    >
      {children}
    </KivaLink>
  );
};

LoanLink.propTypes = {
  id: PT.number,
  className: PT.string,
  loan: PT.shape({
    id: PT.number,
    name: PT.string,
  }),
  title: PT.string,
  children: PT.node,
  hideLogo: PT.bool,
};

LoanLink.defaultProps = {
  id: undefined,
  title: undefined,
  className: undefined,
  loan: undefined,
  children: undefined,
  hideLogo: false,
};

export const EmailLink = ({
  email,
  subject,
  body,
  title,
  className,
  children,
}) => {
  const params = [];
  if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
  if (body) params.push(`body=${encodeURIComponent(body)}`);
  return (
    <NewTabLink
      className={className}
      href={`mailto:${email || 'contact@kivalens.org'}?${params.join('&')}`}
      title={title || 'Open your default email program'}
    >
      {children}
    </NewTabLink>
  );
};

export const KLALink = ({
  children = <span>Kiva Lender Assistant Chrome Extension</span>,
  className,
}) => {
  return (
    <NewTabLink
      className={className}
      href="https://chrome.google.com/webstore/detail/kiva-lender-assistant/jkljjpdljndblihlcoenjbmdakaomhgo?hl=en-US"
      title="Go to Google Chrome WebStore"
    >
      {children}
    </NewTabLink>
  );
};
