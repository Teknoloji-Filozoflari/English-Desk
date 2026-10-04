import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { theme } from './theme';
export function StudyHeader({ eyebrow, title, description, count, unit, wide }: { eyebrow: string; title: string; description: string; count: number; unit: string; wide: boolean }) {
  return <View style={[s.hero, !wide && { padding: 20, gap: 12 }]}>
    <View style={s.copy}><Text style={s.eyebrow}>{eyebrow}</Text><Text accessibilityRole="header" style={[s.title, !wide && { fontSize: 30, letterSpacing: -1 }]}>{title}</Text>{wide && <Text style={s.description}>{description}</Text>}{!wide && <Text style={s.unit}>{count} {unit}</Text>}</View>
    {wide && <View style={s.art} accessible={false}><View style={s.bookBack} /><View style={s.book}><Text style={s.bookType}>Aa</Text><View style={s.bookLine} /><View style={[s.bookLine,{width:42}]} /><Text style={s.bookLabel}>ENGLISH DESK</Text></View><View style={s.circle}><Text style={s.star}>✳</Text></View></View>}
    {wide && <View style={s.stat}><Text style={s.count}>{count}</Text><Text style={s.unit}>{unit}</Text></View>}
  </View>;
}
const s=StyleSheet.create({
 hero:{backgroundColor:'#EAE5DB',borderRadius:22,padding:24,flexDirection:'row',alignItems:'center',gap:24,marginBottom:22,overflow:'hidden',flexWrap:'wrap'},
 copy:{flex:1,minWidth:200,gap:10},eyebrow:{color:theme.accent,fontSize:11,fontWeight:'700',letterSpacing:2},
 title:{fontFamily:Platform.OS==='android'?'serif':'Georgia',fontSize:40,letterSpacing:-1.8,color:theme.ink},description:{fontSize:15,lineHeight:24,color:theme.muted,maxWidth:390},
 stat:{borderLeftWidth:1,borderLeftColor:'#CDC7BA',paddingLeft:24,minWidth:80},count:{fontSize:36,fontWeight:'600',letterSpacing:-1.5,color:theme.ink},unit:{fontSize:12,color:theme.muted,marginTop:5},
 art:{width:145,height:124,marginHorizontal:8},bookBack:{position:'absolute',width:94,height:125,backgroundColor:'#B7C1B2',borderRadius:6,transform:[{rotate:'13deg'}],left:30,top:4},
 book:{width:94,height:125,backgroundColor:'#F9F6EF',borderRadius:6,borderLeftWidth:6,borderLeftColor:'#CF6B46',transform:[{rotate:'-9deg'}],padding:12},bookType:{fontFamily:'Georgia',fontSize:34,color:theme.ink},bookLine:{height:2,width:56,backgroundColor:'#C4B9A5',marginTop:9},bookLabel:{fontSize:6,letterSpacing:1,color:theme.muted,marginTop:12},circle:{position:'absolute',right:0,bottom:0,width:50,height:50,borderRadius:25,backgroundColor:'#E6B16A',alignItems:'center',justifyContent:'center'},star:{fontSize:34,color:'#6B4624'},
});
