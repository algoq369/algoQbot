#!/usr/bin/env python3
"""
BroolyKid Keynote Automation Script
Generates AppleScript commands to automate Keynote presentation creation
"""

import json
import os

def generate_applescript_commands():
    """Generate AppleScript commands for Keynote automation"""

    # Read the presentation data
    with open('BroolyKid_Presentation_Data.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    applescript_commands = []

    # Initial Keynote setup
    applescript_commands.append("""
-- BroolyKid Keynote Automation Script
-- Run this in AppleScript Editor or Script Editor

tell application "Keynote"
    activate

    -- Create new presentation
    set newPresentation to make new document with properties {document theme:theme "Basic White"}

    -- Set presentation properties
    set document properties of newPresentation to {slide size:{1920, 1080}, slide transition:smooth, auto advance:false}

    -- Configure master slide
    set masterSlide to master slide of newPresentation
    set background color of masterSlide to {65535, 65535, 65535} -- White background

    -- Add BroolyKid logo (you'll need to provide the logo file)
    -- set logoImage to (path to desktop as string) & "BroolyKid_Logo.png"
    -- if exists file logoImage then
    --     set logo to make new image with properties {file:logoImage, position:{50, 50}, size:{200, 100}}
    -- end if

    -- Set up color palette
    set colorPalette to {primary blue:{11007, 8055, 28927}, gold:{55769, 44975, 0}, purple:{35723, 23831, 63207}, pink:{60535, 28784, 52685}}

    """)

    # Generate slide creation commands
    for slide in data['slides']:
        slide_num = slide['slide_number']
        title = slide['title']

        applescript_commands.append(f"""
    -- Create Slide {slide_num}: {title}
    set slide{slide_num} to make new slide with properties {{slide layout:layout "Title & Bullets"}}

    -- Set slide title
    set titleText of slide{slide_num} to "{title}"

    -- Add content based on slide type
    """)

        # Add specific content based on slide type
        if slide_num == 1:
            applescript_commands.append(f"""
    -- Title slide with background image
    set background image of slide{slide_num} to (path to desktop as string) & "mountain_sunrise.jpg"
    set text of titleText of slide{slide_num} to "BROOLYKID"
    set subtitle of slide{slide_num} to "Building Sovereign Communities for the Information Age"
    """)

        elif slide_num == 2:
            applescript_commands.append(f"""
    -- Executive summary with 5 columns
    set bulletText of slide{slide_num} to "THE PROJECT
    🏙️ First consciousness-driven smart city
    ⚡ Bitcoin + Monad mining self-financing
    👥 5,000 citizens in free circular economy
    🌍 Blueprint for 10-city global network

    THE ECONOMICS
    💰 Total Investment: $970M over 10 years
    ├─ NOW: $450M (we're raising this) ← YOU
    ├─ Years 3-4: $380M (self-financed from mining)
    └─ Years 5-10: $140M (self-financed from surplus)"
    """)

        elif slide_num == 17:
            applescript_commands.append(f"""
    -- Financial projections table
    set table of slide{slide_num} to make new table with properties {{rows:11, columns:7}}
    -- You'll need to manually populate the table with financial data
    """)

        else:
            # Generic content for other slides
            content_text = ' | '.join(slide['content']).replace('\n', ' ').replace('"', '\\"')
            applescript_commands.append(f"""
    set bulletText of slide{slide_num} to "{content_text[:500]}..."
    """)

    # Final commands
    applescript_commands.append("""
    -- Save the presentation
    save newPresentation in (path to desktop as string) & "BroolyKid_Investor_Presentation.key"

    -- Display completion message
    display dialog "BroolyKid presentation created successfully!" buttons {"OK"} default button "OK"

end tell
""")

    # Write the complete AppleScript
    complete_script = '\n'.join(applescript_commands)

    with open('Create_Keynote_Presentation.applescript', 'w', encoding='utf-8') as f:
        f.write(complete_script)

    print("✅ Created AppleScript: Create_Keynote_Presentation.applescript")
    print("📝 To use this script:")
    print("   1. Open Script Editor on Mac")
    print("   2. Open the Create_Keynote_Presentation.applescript file")
    print("   3. Click Run to execute the script")
    print("   4. The script will create a new Keynote presentation automatically")

def create_quick_start_guide():
    """Create a quick start guide for Keynote creation"""

    guide = """
# BroolyKid Keynote Quick Start Guide

## Option 1: Manual Creation (Recommended)
1. **Open Keynote** on Mac
2. **Create new presentation** with "Basic White" theme
3. **Follow the detailed instructions** in `Keynote_Creation_Instructions.md`
4. **Copy content** from `BroolyKid_Keynote_Presentation.md`
5. **Customize** with your brand colors and images

## Option 2: Automated Creation (Advanced)
1. **Prepare your Mac**:
   - Ensure Keynote is installed
   - Place BroolyKid logo on Desktop as "BroolyKid_Logo.png"
   - Place mountain sunrise image on Desktop as "mountain_sunrise.jpg"

2. **Run the AppleScript**:
   - Open Script Editor
   - Open `Create_Keynote_Presentation.applescript`
   - Click Run
   - The script will create a basic presentation structure

3. **Manual refinement**:
   - Add detailed content to each slide
   - Customize layouts and formatting
   - Add charts and visual elements
   - Include speaker notes

## Option 3: PowerPoint Alternative
1. **Open PowerPoint**
2. **Import from CSV**: Use `BroolyKid_Presentation_Import.csv`
3. **Apply formatting** manually
4. **Export as .pptx**

## Essential Files Created
- `BroolyKid_Keynote_Presentation.md` - Complete slide content
- `BroolyKid_Presentation_Data.json` - Structured data for import
- `Keynote_Creation_Instructions.md` - Detailed step-by-step guide
- `Create_Keynote_Presentation.applescript` - Automation script
- `Presentation_Summary.md` - Quick reference

## Design Assets Needed
1. **BroolyKid Logo** - High-resolution PNG
2. **Mountain Sunrise Background** - For title slide
3. **Icons** - For various concepts (mining, consciousness, etc.)
4. **Charts** - Financial projections and market data
5. **Team Photos** - For team slide

## Brand Guidelines
- **Primary Color**: Deep Blue (#1a1f71)
- **Accent Color**: Gold (#d4af37)
- **Fonts**: Montserrat Bold (headers), Open Sans (body)
- **Style**: Professional, spiritual, innovative

## Timeline
- **Setup**: 30 minutes
- **Content Creation**: 2-3 hours
- **Design Polish**: 1-2 hours
- **Practice**: 1 hour
- **Total**: 4-6 hours

## Tips for Success
1. **Start with structure** - Get all slides created first
2. **Add content** - Fill in all text and data
3. **Design polish** - Apply consistent formatting
4. **Visual elements** - Add charts, images, icons
5. **Practice delivery** - Time yourself for 15 minutes
6. **Backup files** - Save multiple versions

## Quality Checklist
- [ ] All 24 slides created
- [ ] Consistent formatting applied
- [ ] Speaker notes added
- [ ] Financial data verified
- [ ] Brand colors used correctly
- [ ] Presentation timed (15 minutes)
- [ ] Backup files created
- [ ] Export options tested

## Next Steps After Creation
1. **Practice the presentation** multiple times
2. **Prepare for Q&A** - Anticipate investor questions
3. **Create supporting materials** - Financial models, due diligence docs
4. **Schedule presentations** with target investors
5. **Follow up** with interested parties

## Support
If you need help with any step, refer to:
- `Keynote_Creation_Instructions.md` for detailed guidance
- `Presentation_Summary.md` for quick reference
- The original React component for content reference

Good luck with your investor presentation! 🚀
"""

    with open('Keynote_Quick_Start_Guide.md', 'w', encoding='utf-8') as f:
        f.write(guide)

    print("✅ Created Quick Start Guide: Keynote_Quick_Start_Guide.md")

def main():
    """Main function to create automation files"""

    print("🚀 Creating Keynote automation files...")

    generate_applescript_commands()
    create_quick_start_guide()

    print("\n🎉 Keynote automation files created!")
    print("\n📁 Files created:")
    print("   📜 Create_Keynote_Presentation.applescript - Automation script")
    print("   📋 Keynote_Quick_Start_Guide.md - Quick start guide")
    print("\n🚀 Ready to create your Keynote presentation!")
    print("\nRecommended approach:")
    print("   1. Follow the Quick Start Guide")
    print("   2. Use the detailed instructions for best results")
    print("   3. The AppleScript can help with basic setup")
    print("   4. Manual customization will give the best results")

if __name__ == "__main__":
    main()
