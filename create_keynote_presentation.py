#!/usr/bin/env python3
"""
BroolyKid Keynote Presentation Creator
Converts the markdown presentation content into formats suitable for Keynote/PowerPoint import
"""

import json
import re
from pathlib import Path

def parse_presentation_content():
    """Parse the presentation content from the markdown file"""

    slides_data = []

    # Read the markdown file
    with open('BroolyKid_Keynote_Presentation.md', 'r', encoding='utf-8') as f:
        content = f.read()

    # Split into slides
    slide_sections = re.split(r'^## SLIDE \d+:', content, flags=re.MULTILINE)

    for i, section in enumerate(slide_sections[1:], 1):  # Skip first empty section
        lines = section.strip().split('\n')

        # Extract slide title and layout
        slide_title = lines[0].strip()
        layout_info = ""
        speaker_notes = ""

        # Parse slide content
        slide_content = []
        current_section = ""

        for line in lines[1:]:
            line = line.strip()

            if line.startswith('**Layout:**'):
                layout_info = line.replace('**Layout:**', '').strip()
            elif line.startswith('**Speaker Notes:**'):
                speaker_notes = line.replace('**Speaker Notes:**', '').strip()
            elif line.startswith('### ') or line.startswith('**'):
                if current_section:
                    slide_content.append(current_section)
                current_section = line
            elif line.startswith('---'):
                break
            elif line and not line.startswith('**') and not line.startswith('### '):
                if current_section:
                    current_section += '\n' + line
                else:
                    current_section = line

        if current_section:
            slide_content.append(current_section)

        slides_data.append({
            'slide_number': i,
            'title': slide_title,
            'layout': layout_info,
            'content': slide_content,
            'speaker_notes': speaker_notes
        })

    return slides_data

def create_json_export(slides_data):
    """Create JSON export for easy import into presentation software"""

    json_data = {
        'presentation_info': {
            'title': 'BroolyKid Investor Presentation',
            'total_slides': len(slides_data),
            'duration_minutes': 15,
            'audience': 'Strategic Investors',
            'created_date': '2025-01-10'
        },
        'slides': slides_data
    }

    with open('BroolyKid_Presentation_Data.json', 'w', encoding='utf-8') as f:
        json.dump(json_data, f, indent=2, ensure_ascii=False)

    print("✅ Created JSON export: BroolyKid_Presentation_Data.json")

def create_powerpoint_import_csv(slides_data):
    """Create CSV format for PowerPoint import"""

    csv_lines = ['Slide Number,Title,Content,Speaker Notes']

    for slide in slides_data:
        # Clean content for CSV
        content_clean = ' | '.join(slide['content']).replace('\n', ' ').replace('"', '""')
        speaker_clean = slide['speaker_notes'].replace('\n', ' ').replace('"', '""')

        csv_lines.append(f'{slide["slide_number"]},"{slide["title"]}","{content_clean}","{speaker_clean}"')

    with open('BroolyKid_Presentation_Import.csv', 'w', encoding='utf-8') as f:
        f.write('\n'.join(csv_lines))

    print("✅ Created CSV import: BroolyKid_Presentation_Import.csv")

def create_keynote_instructions():
    """Create detailed instructions for Keynote creation"""

    instructions = """
# BroolyKid Keynote Creation Instructions

## Step 1: Setup Keynote
1. Open Keynote on Mac
2. Create new presentation
3. Choose "Basic White" theme
4. Set slide size to 16:9 (1920x1080)

## Step 2: Configure Master Slide
1. Go to Format > Master Slides
2. Edit the master slide:
   - Set background to white (#FFFFFF)
   - Add BroolyKid logo in top-left corner
   - Set slide number in bottom-right
   - Use Montserrat Bold for titles (36pt)
   - Use Open Sans Regular for body text (18pt)

## Step 3: Brand Colors
Add these colors to Keynote color palette:
- Primary Blue: #1a1f71
- Gold Accent: #d4af37
- Purple Gradient: #8B5CF6 to #EC4899
- Background: #FFFFFF

## Step 4: Create Each Slide
Use the provided JSON data to create each slide:

### Slide 1: Title Slide
- Full-bleed background image (mountain sunrise)
- Large title: "BROOLYKID"
- Subtitle: "Building Sovereign Communities for the Information Age"
- Add gradient overlay for text readability

### Slide 2: Executive Summary
- 5-column layout
- Use icons for each section
- Highlight key numbers in gold
- Use bullet points with checkmarks

### Slide 3: The Transition
- 3-column timeline layout
- Use different background colors for each era
- Add connecting arrows between columns

### Slide 4: The Problem
- 3-column problem analysis
- Use red color scheme for problems
- Add impact statistics in highlighted boxes

### Slide 5: The Solution
- Create 4-circle Venn diagram
- Each circle represents one pillar
- Center intersection shows "BROOLYKID"
- Use different colors for each circle

### Slide 6: Three Phases
- Timeline layout
- Use different colors for each phase
- Add milestone markers
- Include key metrics for each phase

### Slide 7: Competitive Positioning
- 2x2 matrix layout
- Show competitors in 3 quadrants
- Highlight BroolyKid as unique fourth quadrant

### Slide 8: Living System
- 3-section layout
- Use architectural diagrams
- Add visual representations of concepts

### Slide 9: Economy & Nomadism
- 3-system description
- Include token economics diagrams
- Show reputation system levels

### Slide 10: Six Advantages
- 2x3 grid layout
- Use numbered icons
- Highlight each advantage

### Slide 11: Target Market
- Funnel diagram (TAM > SAM > SOM)
- Show market sizes with circles
- Add penetration percentages

### Slide 12: Market Validation
- 3-proof layout with charts
- Use growth arrows and statistics
- Include trend indicators

### Slide 13: Perfect Timing
- 4-trend convergence
- Use clock/timing imagery
- Show window of opportunity

### Slide 14: Revenue Model
- Timeline with revenue breakdowns
- Use stacked bar charts
- Show dual mining split

### Slide 15: Bitcoin Assumptions
- 2-column comparison
- Include price charts
- Show upside scenarios

### Slide 16: Circular Economy
- 3-phase transition
- Use circular flow diagrams
- Show progression to free services

### Slide 17: Financial Projections
- Large financial table
- Use conditional formatting for margins
- Include summary metrics

### Slide 18: Capital Structure
- Waterfall chart
- Show funding sources
- Highlight self-financing

### Slide 19: Investor Returns
- 3-scenario analysis
- Use probability bars
- Show IRR comparisons

### Slide 20: Team
- 2x2 team grid
- Include photos and credentials
- Highlight key statistics

### Slide 21: Execution Roadmap
- Timeline with milestones
- Use checkmarks for completed items
- Show quarterly progress

### Slide 22: Risk Mitigation
- 5-risk analysis
- Use checkmarks for mitigations
- Show risk reduction strategies

### Slide 23: Investment Structure
- Overview with breakdowns
- Show equity vs debt split
- Include investor criteria

### Slide 24: Closing
- Quote with vision
- Show next steps
- Include contact information

## Step 5: Add Visual Elements
1. **Charts**: Use Keynote's built-in chart tools
2. **Icons**: Use SF Symbols or custom icons
3. **Images**: Add stock photos for concepts
4. **Animations**: Use subtle transitions
5. **Speaker Notes**: Add to each slide

## Step 6: Final Review
1. Check all slides for consistency
2. Verify all numbers and statistics
3. Test presentation flow
4. Time the presentation (15 minutes)
5. Export as .key file
6. Create PDF backup

## Step 7: Export Options
1. **Keynote (.key)**: For Mac presentations
2. **PowerPoint (.pptx)**: For Windows compatibility
3. **PDF**: For distribution
4. **HTML5**: For web presentation

## Design Tips
- Keep slides uncluttered
- Use consistent spacing
- Highlight key numbers
- Use bullet points sparingly
- Maintain visual hierarchy
- Test on large screens

## File Management
- Save original as "BroolyKid_Investor_Deck.key"
- Create versions for different audiences
- Keep backup copies
- Version control with dates
"""

    with open('Keynote_Creation_Instructions.md', 'w', encoding='utf-8') as f:
        f.write(instructions)

    print("✅ Created detailed instructions: Keynote_Creation_Instructions.md")

def create_presentation_summary(slides_data):
    """Create a presentation summary for quick reference"""

    summary = f"""
# BroolyKid Investor Presentation Summary

## Overview
- **Total Slides**: {len(slides_data)}
- **Duration**: 15 minutes
- **Target**: Strategic Investors
- **Ask**: $450M Series A

## Slide Breakdown
"""

    for slide in slides_data:
        summary += f"\n### Slide {slide['slide_number']}: {slide['title']}\n"
        summary += f"- Layout: {slide['layout']}\n"
        if slide['speaker_notes']:
            summary += f"- Key Message: {slide['speaker_notes'][:100]}...\n"

    summary += """
## Key Messages
1. **Unique Position**: Only BTC-funded consciousness city
2. **Self-Financing**: Zero external capital after this raise
3. **Massive Scale**: $1.2B revenue by Year 10
4. **Conservative Model**: Profitable even if Bitcoin stays flat
5. **World-Class Team**: UFC Champion + AMF-certified partners

## Financial Highlights
- Total Project: $970M over 10 years
- This Round: $450M (Years 1-2)
- Self-Financed: $520M (Years 3-10)
- Expected IRR: 6.8% (conservative)
- Bull Case IRR: 12-15%
- Exit Multiple: 1.6x to 4.0x

## Next Steps
1. Due diligence package review
2. Financial model deep dive
3. Site visit (optional)
4. Term sheet negotiation
5. Close Q1 2026

## Contact
- Email: [Your Email]
- Website: [Project Website]
- Social: @broolykid
"""

    with open('Presentation_Summary.md', 'w', encoding='utf-8') as f:
        f.write(summary)

    print("✅ Created presentation summary: Presentation_Summary.md")

def main():
    """Main function to create all presentation files"""

    print("🚀 Creating BroolyKid Keynote Presentation Files...")

    # Parse the presentation content
    slides_data = parse_presentation_content()
    print(f"✅ Parsed {len(slides_data)} slides from markdown")

    # Create different export formats
    create_json_export(slides_data)
    create_powerpoint_import_csv(slides_data)
    create_keynote_instructions()
    create_presentation_summary(slides_data)

    print("\n🎉 All presentation files created successfully!")
    print("\nFiles created:")
    print("📄 BroolyKid_Presentation_Data.json - JSON format for import")
    print("📊 BroolyKid_Presentation_Import.csv - CSV format for PowerPoint")
    print("📋 Keynote_Creation_Instructions.md - Detailed Keynote instructions")
    print("📝 Presentation_Summary.md - Quick reference summary")
    print("\nNext steps:")
    print("1. Open Keynote on Mac")
    print("2. Follow the instructions in Keynote_Creation_Instructions.md")
    print("3. Import content from BroolyKid_Presentation_Data.json")
    print("4. Customize with your brand colors and images")
    print("5. Add speaker notes and practice your delivery")

if __name__ == "__main__":
    main()
