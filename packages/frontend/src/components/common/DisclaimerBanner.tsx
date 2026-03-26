'use client'
import { useState } from 'react'
import { AlertTriangle, X, ChevronDown } from 'lucide-react'

export default function DisclaimerBanner() {
  const [expanded, setExpanded] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <div className="absolute top-0 right-0 left-0 z-30 bg-amber-50/95 backdrop-blur-sm border-b border-amber-200">
      <div className="flex items-start gap-2 px-3 py-2">
        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <span className="text-xs font-bold text-amber-700">הצהרת אחריות — </span>
          <span className="text-xs text-amber-700/80">
            אזורים דינאמיים הם <strong>ויזואליזציות בלבד</strong>, המבוססות על רצף אירועי התרעה ציבוריים.
            {expanded && (
              <>
                {' '}הם אינם מהווים תחזית מסלול, מידע מודיעיני, או הערכת איום רשמית.
                אזורי ההתרעה הרשמיים (פוליגונים אדומים) הם המקור הסמכותי היחיד.{' '}
                <strong>לעולם אל תסתמך על אזורים משוערים לצרכי הצלת חיים.</strong>
                {' '}פעל תמיד לפי הוראות גורמי החירום הרשמיים.
              </>
            )}
          </span>
          <button
            onClick={() => setExpanded(!expanded)}
            className="mr-1 text-amber-500 hover:text-amber-700 inline-flex items-center gap-0.5 text-xs transition-colors"
          >
            {expanded ? 'פחות' : 'עוד'}
            <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-amber-400 hover:text-amber-600 flex-shrink-0 transition-colors p-0.5"
          aria-label="סגור"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
